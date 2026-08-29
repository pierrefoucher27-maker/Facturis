import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postInvoicePaidEntry, computeTotals } from "@/lib/accounting";
import BankImportForm from "@/components/BankImportForm";

async function getCompany(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user!.id)
    .single();
  return company!;
}

async function importStatement(formData: FormData) {
  "use server";
  const supabase = createClient();
  const company = await getCompany(supabase);
  const rows = JSON.parse(formData.get("rowsJson") as string) as {
    txn_date: string;
    label: string;
    amount: string;
  }[];

  const toInsert = rows
    .filter((r) => r.txn_date && !isNaN(parseFloat(r.amount)))
    .map((r) => ({
      company_id: company.id,
      txn_date: r.txn_date,
      label: r.label,
      amount: parseFloat(r.amount),
    }));

  if (toInsert.length) {
    await supabase.from("bank_transactions").insert(toInsert);
  }

  revalidatePath("/dashboard/accounting/bank");
}

async function matchToInvoice(formData: FormData) {
  "use server";
  const supabase = createClient();
  const company = await getCompany(supabase);

  const txnId = formData.get("txnId") as string;
  const invoiceId = formData.get("invoiceId") as string;
  if (!invoiceId) {
    revalidatePath("/dashboard/accounting/bank");
    return;
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), clients(name)")
    .eq("id", invoiceId)
    .single();
  if (!invoice) return;

  const totals = computeTotals(invoice.invoice_items, invoice.tva_rate);

  const entryId = await postInvoicePaidEntry(
    supabase,
    company.id,
    invoiceId,
    `Encaissement facture ${invoice.number} — ${invoice.clients?.name ?? ""}`,
    totals.totalTTC
  );

  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10) })
    .eq("id", invoiceId);

  await supabase
    .from("bank_transactions")
    .update({ matched_invoice_id: invoiceId, matched_journal_entry_id: entryId })
    .eq("id", txnId);

  revalidatePath("/dashboard/accounting/bank");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/accounting/journal");
  revalidatePath("/dashboard/accounting/balance-sheet");
}

async function unmatch(formData: FormData) {
  "use server";
  const txnId = formData.get("txnId") as string;
  const supabase = createClient();
  await supabase
    .from("bank_transactions")
    .update({ matched_invoice_id: null, matched_journal_entry_id: null })
    .eq("id", txnId);
  revalidatePath("/dashboard/accounting/bank");
}

export default async function BankPage() {
  const supabase = createClient();
  const company = await getCompany(supabase);

  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("*, invoices(number)")
    .eq("company_id", company.id)
    .order("txn_date", { ascending: false });

  const { data: unpaidInvoices } = await supabase
    .from("invoices")
    .select("*, clients(name), invoice_items(quantity, unit_price)")
    .eq("company_id", company.id)
    .in("status", ["sent", "late"]);

  const invoiceOptions = (unpaidInvoices ?? []).map((inv) => ({
    id: inv.id,
    number: inv.number,
    client: inv.clients?.name ?? "",
    total: computeTotals(inv.invoice_items ?? [], inv.tva_rate).totalTTC,
  }));

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-8">
      <div>
        <h1 className="text-2xl mb-6">Rapprochement bancaire</h1>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper text-ink/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Libellé</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {transactions?.map((txn) => (
                <tr key={txn.id} className="border-t border-line">
                  <td className="px-4 py-3">{txn.txn_date}</td>
                  <td className="px-4 py-3">{txn.label}</td>
                  <td className="px-4 py-3 table-num">{Number(txn.amount).toFixed(2)} €</td>
                  <td className="px-4 py-3">
                    {txn.matched_invoice_id ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-paper border border-line text-moss">
                        Rapproché — {txn.invoices?.number}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-paper border border-line">
                        À pointer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {txn.matched_invoice_id ? (
                      <form action={unmatch}>
                        <input type="hidden" name="txnId" value={txn.id} />
                        <button className="btn-secondary text-xs">Annuler</button>
                      </form>
                    ) : (
                      <form action={matchToInvoice} className="flex items-center gap-2 justify-end">
                        <input type="hidden" name="txnId" value={txn.id} />
                        <select name="invoiceId" className="input text-xs py-1" defaultValue="">
                          <option value="">Associer à…</option>
                          {invoiceOptions.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.number} · {inv.client} · {inv.total.toFixed(2)} €
                            </option>
                          ))}
                        </select>
                        <button className="btn-secondary text-xs">Lettrer</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!transactions?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                    Aucune ligne bancaire importée pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card h-fit">
        <h2 className="text-lg mb-4">Importer un relevé</h2>
        <p className="text-xs text-ink/50 mb-4">
          Exportez le relevé CSV depuis votre banque, puis importez-le ici pour le rapprocher de
          vos factures.
        </p>
        <BankImportForm action={importStatement} />
      </div>
    </div>
  );
}
