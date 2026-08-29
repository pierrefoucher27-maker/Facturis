"use client";

import { useState } from "react";
import Papa from "papaparse";

type Row = { txn_date: string; label: string; amount: string };

function parseFrenchDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

function parseAmount(raw: string): string {
  return raw.replace(/\s/g, "").replace(",", ".").replace("€", "");
}

export default function BankImportForm({ action }: { action: (formData: FormData) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        const keys = Object.keys(data[0] || {});
        const dateKey = keys.find((k) => /date/i.test(k)) || keys[0];
        const labelKey =
          keys.find((k) => /libell|label|description/i.test(k)) || keys[1] || keys[0];
        const amountKey = keys.find((k) => /montant|amount/i.test(k)) || keys[2] || keys[1];

        if (!dateKey || !amountKey) {
          setError(
            "Colonnes non reconnues. Le fichier doit contenir une date, un libellé et un montant."
          );
          return;
        }

        const parsed = data
          .filter((r) => r[dateKey] && r[amountKey])
          .map((r) => ({
            txn_date: parseFrenchDate(r[dateKey]),
            label: r[labelKey] || "",
            amount: parseAmount(r[amountKey]),
          }));
        setRows(parsed);
      },
      error: () => setError("Impossible de lire ce fichier CSV."),
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="rowsJson" value={JSON.stringify(rows)} />
      <div>
        <label className="text-xs text-ink/50">Relevé bancaire (CSV : date, libellé, montant)</label>
        <input type="file" accept=".csv" onChange={handleFile} className="input" />
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
      {rows.length > 0 && (
        <div className="card p-0 overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-ink/50 text-xs uppercase tracking-wide sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Libellé</th>
                <th className="text-right px-3 py-2">Montant</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5">{r.txn_date}</td>
                  <td className="px-3 py-1.5">{r.label}</td>
                  <td className="px-3 py-1.5 table-num">{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="submit" disabled={!rows.length} className="btn-primary">
        Importer {rows.length ? `${rows.length} ligne(s)` : ""}
      </button>
    </form>
  );
}
