import { SupabaseClient } from "@supabase/supabase-js";

export type InvoiceItem = { quantity: number; unit_price: number };

export function computeTotals(items: InvoiceItem[], tvaRate: number) {
  const totalHT = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const tva = Math.round(totalHT * (tvaRate / 100) * 100) / 100;
  const totalTTC = Math.round((totalHT + tva) * 100) / 100;
  return { totalHT: Math.round(totalHT * 100) / 100, tva, totalTTC };
}

/**
 * Écriture générée à l'émission d'une facture (créance client) :
 *   Débit  411 Clients        totalTTC
 *   Crédit 706 Prestations    totalHT
 *   Crédit 445710 TVA collectée  tva
 */
export async function postInvoiceIssuedEntry(
  supabase: SupabaseClient,
  companyId: string,
  invoiceId: string,
  label: string,
  totals: { totalHT: number; tva: number; totalTTC: number }
) {
  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .insert({
      company_id: companyId,
      label,
      source_type: "invoice_issued",
      source_id: invoiceId,
    })
    .select()
    .single();
  if (entryErr) throw entryErr;

  const lines = [
    { entry_id: entry.id, account_code: "411", debit: totals.totalTTC, credit: 0 },
    { entry_id: entry.id, account_code: "706", debit: 0, credit: totals.totalHT },
  ];
  if (totals.tva > 0) {
    lines.push({ entry_id: entry.id, account_code: "445710", debit: 0, credit: totals.tva });
  }

  const { error: linesErr } = await supabase.from("journal_lines").insert(lines);
  if (linesErr) throw linesErr;
  return entry.id as string;
}

/**
 * Écriture générée à l'encaissement d'une facture :
 *   Débit  512 Banque    totalTTC
 *   Crédit 411 Clients   totalTTC
 */
export async function postInvoicePaidEntry(
  supabase: SupabaseClient,
  companyId: string,
  invoiceId: string,
  label: string,
  totalTTC: number
) {
  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .insert({
      company_id: companyId,
      label,
      source_type: "invoice_paid",
      source_id: invoiceId,
    })
    .select()
    .single();
  if (entryErr) throw entryErr;

  const { error: linesErr } = await supabase.from("journal_lines").insert([
    { entry_id: entry.id, account_code: "512", debit: totalTTC, credit: 0 },
    { entry_id: entry.id, account_code: "411", debit: 0, credit: totalTTC },
  ]);
  if (linesErr) throw linesErr;
  return entry.id as string;
}

export type AccountBalance = {
  code: string;
  label: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

/**
 * Calcule la balance des comptes (base du bilan et du compte de résultat) :
 * pour chaque compte, somme des débits/crédits de toutes les écritures du journal.
 */
export function computeAccountBalances(
  accounts: { code: string; label: string; type: string }[],
  lines: { account_code: string; debit: number; credit: number }[]
): AccountBalance[] {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    const t = totals.get(line.account_code) || { debit: 0, credit: 0 };
    t.debit += Number(line.debit);
    t.credit += Number(line.credit);
    totals.set(line.account_code, t);
  }
  return accounts.map((a) => {
    const t = totals.get(a.code) || { debit: 0, credit: 0 };
    // Convention : actif/charge -> solde débiteur normal ; passif/produit -> solde créditeur normal
    const balance =
      a.type === "actif" || a.type === "charge" ? t.debit - t.credit : t.credit - t.debit;
    return { code: a.code, label: a.label, type: a.type, debit: t.debit, credit: t.credit, balance };
  });
}

/**
 * Bilan simplifié : Actif total doit égaler Passif + Capitaux propres (résultat).
 * Le résultat de l'exercice (produits - charges) est injecté comme ligne de passif ("capitaux propres").
 */
export function computeBalanceSheet(balances: AccountBalance[]) {
  const actif = balances.filter((b) => b.type === "actif" && Math.abs(b.balance) > 0.001);
  const passif = balances.filter((b) => b.type === "passif" && Math.abs(b.balance) > 0.001);
  const produits = balances.filter((b) => b.type === "produit");
  const charges = balances.filter((b) => b.type === "charge");

  const totalProduits = produits.reduce((s, b) => s + b.balance, 0);
  const totalCharges = charges.reduce((s, b) => s + b.balance, 0);
  const resultatExercice = Math.round((totalProduits - totalCharges) * 100) / 100;

  const totalActif = Math.round(actif.reduce((s, b) => s + b.balance, 0) * 100) / 100;
  const totalPassifHorsResultat = Math.round(passif.reduce((s, b) => s + b.balance, 0) * 100) / 100;

  return {
    actif,
    passif,
    produits,
    charges,
    totalActif,
    totalPassifHorsResultat,
    resultatExercice,
    totalPassif: Math.round((totalPassifHorsResultat + resultatExercice) * 100) / 100,
  };
}
