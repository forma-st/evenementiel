import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

/** Nouvelles notifications non lues depuis `since` (notifications flottantes). Sans `since` : renvoie seulement l'heure du serveur. */
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role === "CLIENT") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const now = new Date();
  const raw = new URL(req.url).searchParams.get("since");
  const since = raw ? new Date(raw) : null;
  if (!since || Number.isNaN(since.getTime())) return NextResponse.json({ now: now.toISOString(), items: [] });
  const items = await db.notification.findMany({
    where: { userId: u.id, readAt: null, createdAt: { gt: since, lte: now } },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, type: true, title: true, body: true, link: true },
  });
  return NextResponse.json({ now: now.toISOString(), items }, { headers: { "Cache-Control": "no-store" } });
}
