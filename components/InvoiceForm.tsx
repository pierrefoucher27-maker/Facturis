"use client";

import { useState } from "react";

type Client = { id: string; name: string };

type Line = { description: string; quantity: string; unit_price: string };

export default function InvoiceForm({
  clients,
  defaultClientId,
  action,
}: {
  clients: Client[];
  defaultClientId?: string;
  action: (formData: FormData) => void;
}) {
  const [lines, setLines] = useState<Line[]>([
    { description: "", quantity: "1", unit_price: "" },
  ]);
  const [tvaRate, setTvaRate] = useState("20");

  const totalHT = lines.reduce(
    (sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0),
    0
  );
  const tva = Math.round(totalHT * (parseFloat(tvaRate) / 100) * 100) / 100;
  const totalTTC = Math.round((totalHT + tva) * 100) / 100;

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-ink/50">Client</label>
          <select name="clientId" required defaultValue={defaultClientId} className="input">
            <option value="" disabled>
              Choisir un client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink/50">Taux de TVA (%)</label>
          <input
            name="tvaRate"
            type="number"
            step="0.01"
            value={tvaRate}
            onChange={(e) => setTvaRate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="text-xs text-ink/50">Date d&apos;émission</label>
          <input
            name="issueDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="input"
          />
        </div>
        <div>
          <label className="text-xs text-ink/50">Date d&apos;échéance</label>
          <input name="dueDate" type="date" className="input" />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-ink/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-right px-4 py-3 w-24">Quantité</th>
              <th className="text-right px-4 py-3 w-32">Prix unitaire</th>
              <th className="text-right px-4 py-3 w-32">Total HT</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-4 py-2">
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    placeholder="Prestation, produit…"
                    required
                    className="input"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={line.quantity}
                    onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    type="number"
                    step="0.01"
                    className="input text-right"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={line.unit_price}
                    onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                    type="number"
                    step="0.01"
                    required
                    className="input text-right"
                  />
                </td>
                <td className="px-4 py-2 table-num">
                  {((parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0)).toFixed(2)} €
                </td>
                <td className="px-4 py-2 text-right">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-ink/40 hover:text-clay text-xs"
                      aria-label="Supprimer la ligne"
                    >
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-line">
          <button
            type="button"
            onClick={() =>
              setLines((prev) => [...prev, { description: "", quantity: "1", unit_price: "" }])
            }
            className="btn-secondary text-xs"
          >
            Ajouter une ligne
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="w-64 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-ink/60">Total HT</span>
            <span className="table-num">{totalHT.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">TVA ({tvaRate || 0}%)</span>
            <span className="table-num">{tva.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between font-medium border-t border-line pt-1">
            <span>Total TTC</span>
            <span className="table-num">{totalTTC.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      <button type="submit" className="btn-primary">
        Créer la facture
      </button>
    </form>
  );
}
