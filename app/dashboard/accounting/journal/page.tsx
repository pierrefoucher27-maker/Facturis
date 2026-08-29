import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

async function addManualEntry(formData: FormData) {
  "use server";
  const supabase = createClient();
  const company = await getCompany(supabase);

  const label = formData.get("label") as string;
  const entryDate = (formData.get("entryDate") as string) || undefined;
  const debitAccount = formData.get("debitAccount") as string;
  const creditAccount = formData.get("creditAccount") as string;
  const amount = parseFloat(formData.get("amount") as string);

  if (!label || !debitAccount || !creditAccount || !amount || amount <= 0) {
    redirect("/dashboard/accounting/journal?error=Formulaire+incomplet");
  }

  const { data: entry, error } = await supabase
    .from("journal_entries")
    .insert({ company_id: company.id, label, entry_date: entryDate, source_type: "manual" })
    .select()
    .single();

  if (error || !entry) {
    redirect(`/dashboard/accounting/journal?error=${encodeURIComponent(error?.message || "Erreur")}`);
  }

  await supabase.from("journal_lines").insert([
    { entry_id: entry!.id, account_code: debitAccount, debit: amount, credit: 0 },
    { entry_id: entry!.id, account_code: creditAccount, debit: 0, credit: amount },
  ]);

  revalidatePath("/dashboard/accounting/journal");
  revalidatePath("/dashboard/accounting/balance-sheet");
  redirect("/dashboard/accounting/journal");
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const company = await getCompany(supabase);

  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("code, label, type")
    .eq("company_id", company.id)
    .order("code");

  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*, journal_lines(*)")
    .eq("company_id", company.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  const accountLabel = (code: string) => {
    const a = accounts?.find((a) => a.code === code);
    return a ? `${a.code} · ${a.label}` : code;
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-8">
      <div>
        <h1 className="text-2xl mb-6">Journal comptable</h1>
        <div className="space-y-4">
          {entries?.map((entry) => {
            const totalDebit = entry.journal_lines.reduce(
              (s: number, l: any) => s + Number(l.debit),
              0
            );
            return (
              <div key={entry.id} className="card">
                <div className="flex justify-between text-xs text-ink/40 uppercase tracking-wide mb-3">
                  <span>{entry.entry_date}</span>
                  <span>{totalDebit.toFixed(2)} €</span>
                </div>
                <p className="text-sm font-medium mb-3">{entry.label}</p>
                <table className="w-full text-sm font-mono">
                  <tbody>
                    {entry.journal_lines.map((line: any) => (
                      <tr key={line.id}>
                        <td className="text-ink/70 py-0.5">{accountLabel(line.account_code)}</td>
                        <td className="table-num w-24">
                          {Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : ""}
                        </td>
                        <td className="table-num w-24">
                          {Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {!entries?.length && (
            <p className="text-sm text-ink/50">Aucune écriture pour l&apos;instant.</p>
          )}
        </div>
      </div>

      <div className="card h-fit">
        <h2 className="text-lg mb-4">Saisir une écriture</h2>
        {searchParams.error && <p className="text-sm text-clay mb-3">{searchParams.error}</p>}
        <form action={addManualEntry} className="space-y-3">
          <input name="label" required placeholder="Libellé" className="input" />
          <input
            name="entryDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="input"
          />
          <div>
            <label className="text-xs text-ink/50">Compte débité</label>
            <select name="debitAccount" required className="input">
              {accounts?.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink/50">Compte crédité</label>
            <select name="creditAccount" required className="input">
              {accounts?.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.label}
                </option>
              ))}
            </select>
          </div>
          <input name="amount" type="number" step="0.01" required placeholder="Montant" className="input" />
          <button type="submit" className="btn-primary w-full">
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
}
