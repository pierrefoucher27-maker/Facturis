import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postInvoicePaidEntry, computeTotals } from "@/lib/accounting";

async function getCompanyId(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user!.id)
    .single();
  return company!.id as string;
}

async function markAsPaid(formData: FormData) {
  "use server";
  const invoiceId = formData.get("invoiceId") as string;
  const supabase = createClient();
  const companyId = await getCompanyId(supabase);

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), clients(name)")
    .eq("id", invoiceId)
    .single();
  if (!invoice) return;

  const totals = computeTotals(invoice.invoice_items, invoice.tva_rate);

  await postInvoicePaidEntry(
    supabase,
    companyId,
    invoiceId,
    `Encaissement facture ${invoice.number} — ${invoice.clients?.name ?? ""}`,
    totals.totalTTC
  );

  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10) })
    .eq("id", invoiceId);

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/accounting/journal");
  revalidatePath("/dashboard/accounting/balance-sheet");
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  late: "En retard",
  cancelled: "Annulée",
};

export default async function InvoicesPage() {
  const supabase = createClient();
  const companyId = await getCompanyId(supabase);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, clients(name), invoice_items(quantity, unit_price)")
    .eq("company_id", companyId)
    .order("issue_date", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl">Factures</h1>
        <Link href="/dashboard/invoices/new" className="btn-primary">
          Nouvelle facture
        </Link>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-ink/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">N°</th>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Émise le</th>
              <th className="text-right px-4 py-3">Total TTC</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv) => {
              const totals = computeTotals(inv.invoice_items ?? [], inv.tva_rate);
              return (
                <tr key={inv.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono">{inv.number}</td>
                  <td className="px-4 py-3">{inv.clients?.name}</td>
                  <td className="px-4 py-3">{inv.issue_date}</td>
                  <td className="px-4 py-3 table-num">{totals.totalTTC.toFixed(2)} €</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-paper border border-line">
                      {STATUS_LABEL[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.status !== "paid" && (
                      <form action={markAsPaid}>
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <button className="btn-secondary text-xs">Marquer payée</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!invoices?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                  Aucune facture pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
