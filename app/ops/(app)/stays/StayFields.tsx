import { Field, input } from "../../kit";

type V = { propertyId?: number; checkIn?: string; checkOut?: string; guestName?: string | null; phone?: string | null; guests?: number | null; amount?: number | null; notes?: string | null; status?: string };

export function StayFields({ flats, v = {}, imported, kind }: { flats: { id: number; code: string; name: string }[]; v?: V; imported?: boolean; kind?: "booking" | "block" }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!imported && (
        <>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[13px] font-medium">What is it?</legend>
            <div className="grid grid-cols-2 gap-2">
              {([["booking", "Guest booking", "Direct, phone or walk-in"], ["block", "Block dates", "Owner stay, repairs, hold"]] as const).map(([k, l, h]) => (
                <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--line)] p-3 has-[:checked]:border-[var(--acc)] has-[:checked]:bg-[var(--acc)]/5">
                  <input type="radio" name="kind" value={k} defaultChecked={(kind ?? (v.status === "blocked" ? "block" : "booking")) === k} className="mt-0.5 accent-[var(--acc)]" />
                  <span><span className="block text-sm font-medium">{l}</span><span className="block text-xs text-[var(--muted)]">{h}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Flat" className="sm:col-span-2">
            <select name="propertyId" required defaultValue={v.propertyId ?? ""} className={input}>
              <option value="" disabled>Choose…</option>
              {flats.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}
            </select>
          </Field>
          <Field label="Check-in"><input name="checkIn" type="date" required defaultValue={v.checkIn} className={input} /></Field>
          <Field label="Check-out" hint="The morning they leave."><input name="checkOut" type="date" required defaultValue={v.checkOut} className={input} /></Field>
        </>
      )}
      <Field label="Guest name"><input name="guestName" defaultValue={v.guestName ?? ""} autoComplete="off" className={input} /></Field>
      <Field label="Phone (WhatsApp)"><input name="phone" type="tel" inputMode="tel" defaultValue={v.phone ?? ""} placeholder="98765 43210" className={input} /></Field>
      <Field label="Guests"><input name="guests" type="number" min={1} max={40} defaultValue={v.guests ?? ""} className={input} /></Field>
      <Field label="Amount (₹)" hint="What we receive for the stay."><input name="amount" inputMode="numeric" defaultValue={v.amount ?? ""} className={input} /></Field>
      <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={2} defaultValue={v.notes ?? ""} placeholder="Early check-in requested…" className={input} /></Field>
    </div>
  );
}
