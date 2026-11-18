import { TZ } from "./format";

export const EVENT_TYPES = [
  { id: "PRESTATION", label: "Prestation", icon: "🎧", chip: "bg-blue-100 text-blue-900 border-blue-300", dot: "bg-brand-600" },
  { id: "RDV", label: "Rendez-vous client", icon: "🤝", chip: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-500" },
  { id: "VISITE", label: "Visite / repérage du lieu", icon: "📍", chip: "bg-teal-100 text-teal-800 border-teal-300", dot: "bg-teal-500" },
  { id: "INSTALL", label: "Installation / livraison", icon: "🚚", chip: "bg-orange-100 text-orange-800 border-orange-300", dot: "bg-orange-500" },
  { id: "APPEL", label: "Appel téléphonique", icon: "☎", chip: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-500" },
  { id: "VISIO", label: "Visio", icon: "🎥", chip: "bg-blue-100 text-blue-800 border-blue-300", dot: "bg-blue-500" },
  { id: "REUNION", label: "Réunion d'équipe", icon: "👥", chip: "bg-sky-100 text-sky-800 border-sky-300", dot: "bg-sky-500" },
  { id: "INDISPO", label: "Indisponibilité", icon: "⛔", chip: "bg-zinc-200 text-zinc-700 border-zinc-300", dot: "bg-zinc-500" },
  { id: "AUTRE", label: "Autre", icon: "•", chip: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-400" },
] as const;

export const eventType = (id: string) => EVENT_TYPES.find((t) => t.id === id) ?? EVENT_TYPES[EVENT_TYPES.length - 1];

const gcal = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Lien « Ajouter à Google Agenda » (ouvre Google Agenda pré-rempli). */
export function googleCalendarLink(e: { title: string; start: Date; end: Date; location?: string | null; description?: string | null }, url?: string) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${gcal(e.start)}/${gcal(e.end)}`,
    ctz: TZ,
    details: [e.description, url && `Fiche : ${url}`].filter(Boolean).join("\n\n"),
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Échappement des textes iCalendar (RFC 5545). */
const ics = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
/** Coupe les lignes à 75 octets environ. */
const fold = (line: string) => line.match(/.{1,72}/g)!.join("\r\n ");

export function toICS(calName: string, events: { id: string; title: string; start: Date; end: Date; location: string | null; description: string | null; type: string; updatedAt: Date; clientName?: string | null }[], baseUrl: string) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Studio Evenements//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${ics(calName)}`, `X-WR-TIMEZONE:${TZ}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    const t = eventType(e.type);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@studio-evenements`,
      `DTSTAMP:${gcal(e.updatedAt)}`,
      `DTSTART:${gcal(e.start)}`,
      `DTEND:${gcal(e.end)}`,
      fold(`SUMMARY:${ics(`${t.icon} ${e.title}${e.clientName ? ` — ${e.clientName}` : ""}`)}`),
      ...(e.location ? [fold(`LOCATION:${ics(e.location)}`)] : []),
      fold(`DESCRIPTION:${ics([t.label, e.description, `${baseUrl}/agenda/${e.id}`].filter(Boolean).join("\n\n"))}`),
      `URL:${baseUrl}/agenda/${e.id}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
