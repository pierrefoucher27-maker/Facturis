import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeTotals, computeAccountBalances, computeBalanceSheet } from "@/lib/accounting";

async function getCompany(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("owner_id", user!.id)
    .single();
  return company!;
}

export default async function DashboardHome() {
  const supabase = createClient();
  const company = await getCompany(supabase);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, invoice_items(quantity, unit_price)")
    .eq("company_id", company.id);

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
  const banque = balances.find((b) => b.code === "512")?.balance ?? 0;

  const totalFacture = (invoices ?? []).reduce(
    (s, inv) => s + computeTotals(inv.invoice_items ?? [], inv.tva_rate).totalTTC,
    0
  );
  const totalImpaye = (invoices ?? [])
    .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
    .reduce((s, inv) => s + computeTotals(inv.invoice_items ?? [], inv.tva_rate).totalTTC, 0);

  const kpis = [
    { label: "Facturé (TTC)", value: totalFacture },
    { label: "En attente de paiement", value: totalImpaye },
    { label: "Solde banque", value: banque },
    { label: "Résultat net", value: sheet.resultatExercice },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl">Vue d&apos;ensemble — {company.name}</h1>
        <Link href="/dashboard/invoices/new" className="btn-primary">
          Nouvelle facture
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <p className="text-xs text-ink/50 mb-2">{k.label}</p>
            <p className="text-2xl font-mono tabular-nums">{k.value.toFixed(2)} €</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/dashboard/accounting/journal" className="card hover:border-ink transition-colors">
          <h2 className="text-lg mb-1">Journal comptable</h2>
          <p className="text-sm text-ink/50">Toutes les écritures en partie double.</p>
        </Link>
        <Link
          href="/dashboard/accounting/balance-sheet"
          className="card hover:border-ink transition-colors"
        >
          <h2 className="text-lg mb-1">Bilan</h2>
          <p className="text-sm text-ink/50">Actif, passif et résultat de l&apos;exercice.</p>
        </Link>
        <Link href="/dashboard/accounting/bank" className="card hover:border-ink transition-colors">
          <h2 className="text-lg mb-1">Rapprochement bancaire</h2>
          <p className="text-sm text-ink/50">Importez et lettrez votre relevé.</p>
        </Link>
      </div>
    </div>
  );
}
