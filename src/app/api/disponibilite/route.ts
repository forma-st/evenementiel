import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { dateConflicts } from "@/lib/merge";
import { fromParis, statusOf } from "@/lib/format";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET", "Cache-Control": "no-store" };

/**
 * Disponibilité d'une date.
 * - Équipe connectée : liste des prestations du jour.
 * - Public (widget de votre site) : { date, available } seulement. Nombre de prestations simultanées possible : MAX_EVENTS_PER_DAY (1 par défaut).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const day = u.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: "date attendue au format AAAA-MM-JJ" }, { status: 400, headers: CORS });
  const user = await currentUser();
  const list = await dateConflicts(fromParis(day, "12:00"), u.searchParams.get("exclure") ?? undefined);
  if (user && user.role !== "CLIENT")
    return NextResponse.json({ date: day, conflicts: list.map((c) => ({ id: c.id, reference: c.reference, title: c.title, status: statusOf(c.status).label, assignee: c.assignee?.name ?? null })) });
  const max = Math.max(1, Number(process.env.MAX_EVENTS_PER_DAY) || 1);
  return NextResponse.json({ date: day, available: list.length < max }, { headers: CORS });
}
