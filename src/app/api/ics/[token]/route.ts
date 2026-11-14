import { db } from "@/lib/db";
import { toICS } from "@/lib/events";

/** Flux iCalendar personnel : à ajouter dans Google Agenda (« À partir de l'URL »). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const raw = token.replace(/\.ics$/, "");
  if (raw.length < 20) return new Response("Introuvable", { status: 404 });
  const user = await db.user.findFirst({ where: { icsToken: raw, active: true } });
  if (!user) return new Response("Introuvable", { status: 404 });
  const from = new Date(Date.now() - 90 * 864e5);
  const events = await db.event.findMany({
    where: { end: { gt: from }, OR: [{ organizerId: user.id }, { attendees: { some: { userId: user.id } } }] },
    include: { client: { select: { name: true } } },
    orderBy: { start: "asc" },
    take: 2000,
  });
  const url = new URL(req.url);
  const base = `${req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") ?? url.host}`;
  const body = toICS(`Agenda — ${user.name}`, events.map((e) => ({ ...e, clientName: e.client?.name })), base);
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="crm-formast.ics"', "Cache-Control": "no-store" },
  });
}
