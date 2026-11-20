import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { equipmentAvailability } from "@/lib/equipment";
import { fromParis } from "@/lib/format";

/** Disponibilité du parc pour un créneau (formulaire de création d'une location ou d'un prêt). */
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role === "CLIENT") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const day = sp.get("date") ?? "", endDay = sp.get("fin") || day;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{4}-\d{2}-\d{2}$/.test(endDay)) return NextResponse.json({ items: [] });
  const start = fromParis(day, /^\d{2}:\d{2}$/.test(sp.get("debut") ?? "") ? sp.get("debut")! : "10:00");
  let end = fromParis(endDay, /^\d{2}:\d{2}$/.test(sp.get("heureFin") ?? "") ? sp.get("heureFin")! : "18:00");
  if (end <= start) end = new Date(end.getTime() + 864e5);
  const items = await equipmentAvailability(sp.get("exclure") ?? "", start, end);
  return NextResponse.json({ items: items.map((i) => ({ id: i.id, name: i.name, category: i.category, stock: i.stock, available: i.stock - i.elsewhere, conflicts: i.conflicts.map((c) => c.reference) })) });
}
