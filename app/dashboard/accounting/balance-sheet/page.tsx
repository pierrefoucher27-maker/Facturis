import { createClient } from "@/lib/supabase/server";
import { computeAccountBalances, computeBalanceSheet } from "@/lib/accounting";

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

export default async function BalanceSheetPage() {
  const supabase = createClient();
  const company = await getCompany(supabase);

  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("code, label, type")
    .eq("company_id", company.id);

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("account_code, debit, credit, journal_entries!inner(company_id)")
    .eq("journal_entries.company_id", company.id);

  const balances = computeAccountBalances(accounts ?? [], lines ?? []);
  const sheet = computeBalanceSheet(balances);

  const equilibre = Math.abs(sheet.totalActif - sheet.totalPassif) < 0.01;

  return (
    <div>
      <h1 className="text-2xl mb-6">Bilan</h1>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="text-lg mb-4">Actif</h2>
          <table className="w-full text-sm">
            <tbody>
              {sheet.actif.map((a) => (
                <tr key={a.code} className="border-t border-line">
                  <td className="py-2 text-ink/70">
                    {a.code} · {a.label}
                  </td>
                  <td className="py-2 table-num">{a.balance.toFixed(2)} €</td>
                </tr>
              ))}
              {!sheet.actif.length && (
                <tr>
                  <td className="py-2 text-ink/40 text-sm" colSpan={2}>
                    Aucun solde actif.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-medium">
                <td className="py-2">Total actif</td>
                <td className="py-2 table-num">{sheet.totalActif.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card">
          <h2 className="text-lg mb-4">Passif &amp; capitaux propres</h2>
          <table className="w-full text-sm">
            <tbody>
              {sheet.passif.map((a) => (
                <tr key={a.code} className="border-t border-line">
                  <td className="py-2 text-ink/70">
                    {a.code} · {a.label}
                  </td>
                  <td className="py-2 table-num">{a.balance.toFixed(2)} €</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-2 text-ink/70">Résultat de l&apos;exercice</td>
                <td className="py-2 table-num">{sheet.resultatExercice.toFixed(2)} €</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-medium">
                <td className="py-2">Total passif</td>
                <td className="py-2 table-num">{sheet.totalPassif.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className={`card text-sm ${equilibre ? "text-moss" : "text-clay"}`}>
        {equilibre
          ? `Bilan équilibré — ${sheet.totalActif.toFixed(2)} € = ${sheet.totalPassif.toFixed(2)} €`
          : `Écart de ${(sheet.totalActif - sheet.totalPassif).toFixed(2)} € entre actif et passif — vérifiez les écritures manuelles.`}
      </div>

      <div className="card mt-6">
        <h2 className="text-lg mb-4">Compte de résultat</h2>
        <table className="w-full text-sm">
          <tbody>
            {sheet.produits.map((p) => (
              <tr key={p.code} className="border-t border-line">
                <td className="py-2 text-ink/70">
                  {p.code} · {p.label}
                </td>
                <td className="py-2 table-num text-moss">+{p.balance.toFixed(2)} €</td>
              </tr>
            ))}
            {sheet.charges.map((c) => (
              <tr key={c.code} className="border-t border-line">
                <td className="py-2 text-ink/70">
                  {c.code} · {c.label}
                </td>
                <td className="py-2 table-num text-clay">-{c.balance.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-medium">
              <td className="py-2">Résultat net</td>
              <td className="py-2 table-num">{sheet.resultatExercice.toFixed(2)} €</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
