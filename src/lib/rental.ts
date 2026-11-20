/** Location de matériel sans technicien : durée, états des lieux. */
export type CheckoutItem = { id: string; name: string; qty: number; ok: boolean };
export type CheckinItem = { id: string; name: string; qty: number; returned: number; damaged: number; note: string };
export type Checkout = { at: string; by: string; items: CheckoutItem[]; notes: string; signature?: { name: string; png: string; at: string } };
export type Checkin = { at: string; by: string; items: CheckinItem[]; notes: string; damages: number };

/** Nombre de jours facturés (24 h entamées, 1 jour minimum). */
export function rentalDays(start: Date | null, end: Date | null) {
  if (!start || !end) return 1;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 864e5 - 0.01));
}

export const CAUTION_STATUSES: Record<string, { label: string; color: string }> = {
  "": { label: "Non demandée", color: "bg-slate-100 text-slate-600" },
  A_RECEVOIR: { label: "À recevoir", color: "bg-amber-100 text-amber-800" },
  RECUE: { label: "Reçue", color: "bg-blue-100 text-blue-800" },
  RESTITUEE: { label: "Restituée", color: "bg-emerald-100 text-emerald-700" },
  RETENUE: { label: "Retenue (en partie ou totalité)", color: "bg-rose-100 text-rose-700" },
};

export function parseJson<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}
