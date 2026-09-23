"use client";

import { useState } from "react";
import type { PolicyTable } from "@/lib/site";
import { btnGhost } from "./ui";

const cell = "w-full min-w-28 rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand";

/** Spreadsheet-style editor for a policy grid. Posts JSON in a hidden input. */
export function TableEditor({ name, initial }: { name: string; initial: PolicyTable }) {
  const [t, setT] = useState<PolicyTable>(initial);
  const setCol = (i: number, v: string) => setT({ ...t, columns: t.columns.map((c, j) => (j === i ? v : c)) });
  const setCell = (r: number, c: number, v: string) =>
    setT({ ...t, rows: t.rows.map((row, i) => (i === r ? { ...row, cells: row.cells.map((x, j) => (j === c ? v : x)) } : row)) });

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(t)} />
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="p-1 text-left text-xs font-medium text-gray-500">Row ↓ / Column →</th>
              {t.columns.map((c, i) => (
                <th key={i} className="p-1">
                  <div className="flex gap-1">
                    <input value={c} onChange={(e) => setCol(i, e.target.value)} className={`${cell} font-semibold`} aria-label={`Column ${i + 1}`} />
                    <button type="button" onClick={() => setT({ ...t, columns: t.columns.filter((_, j) => j !== i), rows: t.rows.map((r) => ({ ...r, cells: r.cells.filter((_, j) => j !== i) })) })}
                      className="px-1 text-red-600" aria-label="Remove column">✕</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, ri) => (
              <tr key={ri}>
                <td className="p-1">
                  <div className="flex gap-1">
                    <input value={r.label} onChange={(e) => setT({ ...t, rows: t.rows.map((x, i) => (i === ri ? { ...x, label: e.target.value } : x)) })} className={`${cell} font-semibold`} aria-label={`Row ${ri + 1}`} />
                    <button type="button" onClick={() => setT({ ...t, rows: t.rows.filter((_, i) => i !== ri) })} className="px-1 text-red-600" aria-label="Remove row">✕</button>
                  </div>
                </td>
                {r.cells.map((v, ci) => (
                  <td key={ci} className="p-1"><input value={v} onChange={(e) => setCell(ri, ci, e.target.value)} className={cell} aria-label={`${r.label} – ${t.columns[ci]}`} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" className={btnGhost} onClick={() => setT({ ...t, rows: [...t.rows, { label: "New row", cells: t.columns.map(() => "") }] })}>+ Row</button>
        <button type="button" className={btnGhost} onClick={() => setT({ ...t, columns: [...t.columns, "New column"], rows: t.rows.map((r) => ({ ...r, cells: [...r.cells, ""] })) })}>+ Column</button>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Notes under the table (markdown)</span>
        <textarea value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} rows={5}
          placeholder={"- **GST:** Any GST charged is non-refundable.\n- **Refund timeline:** 5–7 working days to the original payment method."}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand" />
      </label>
    </div>
  );
}
