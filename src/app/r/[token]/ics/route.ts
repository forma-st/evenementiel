import { fromParis } from "@/lib/format";
import { loadInvite } from "@/lib/helperInvite";

const ics = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Fichier agenda de la mission (uniquement pour le renfort retenu). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const inv = await loadInvite((await params).token);
  if (!inv || inv.request.helperId !== inv.helperId || !inv.request.date) return new Response("Introuvable", { status: 404 });
  const r = inv.request;
  const start = fromParis(r.date!, r.startTime ?? "09:00");
  let end = fromParis(r.date!, r.endTime ?? "23:00");
  if (end <= start) end = new Date(end.getTime() + 864e5);
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//evenementiel//FR", "BEGIN:VEVENT", `UID:${inv.id}@evenementiel`, `DTSTAMP:${ics(new Date())}`, `DTSTART:${ics(start)}`, `DTEND:${ics(end)}`, `SUMMARY:${esc(r.title)}`, `LOCATION:${esc([r.venue, r.city].filter(Boolean).join(", "))}`, `DESCRIPTION:${esc(r.notes ?? "")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "attachment; filename=mission.ics" } });
}
