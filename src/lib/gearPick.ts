import { equipmentAvailability } from "./equipment";

const s = (f: FormData, k: string) => { const v = f.get(k); return v == null || String(v).trim() === "" ? null : String(v).trim(); };

/** Matériel choisi dans le formulaire (JSON [{id, qty}]) vérifié contre les disponibilités du créneau. */
export async function parseGear(f: FormData, start: Date | null, end: Date | null, exclude = "") {
  let raw: unknown = [];
  try { raw = JSON.parse(s(f, "equipment") ?? "[]"); } catch { return { error: "Liste de matériel illisible." } as const; }
  const wanted = new Map<string, number>();
  for (const x of Array.isArray(raw) ? raw : []) {
    const id = typeof x?.id === "string" ? x.id : "";
    const q = Math.round(Number(x?.qty));
    if (id && q > 0) wanted.set(id, Math.min(999, (wanted.get(id) ?? 0) + q));
  }
  if (!wanted.size) return { items: [] as { id: string; qty: number }[] } as const;
  const av = await equipmentAvailability(exclude, start, end);
  for (const [id, qty] of wanted) {
    const a = av.find((x) => x.id === id);
    if (!a) return { error: "Un matériel choisi n'existe plus." } as const;
    const free = a.stock - a.elsewhere;
    if (qty > free) return { error: free <= 0 ? `« ${a.name} » n'est plus disponible sur ce créneau (réservé par ${a.conflicts.map((c) => c.reference).join(", ")}).` : `Seulement ${free} « ${a.name} » disponible(s) sur ce créneau.` } as const;
  }
  return { items: [...wanted].map(([id, qty]) => ({ id, qty })) } as const;
}

