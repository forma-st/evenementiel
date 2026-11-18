import { db } from "./db";
import { getCompany, getLogo } from "./company";
import { quoteToPdf } from "./pdf";
import { parseLines } from "./quotes";
import { eventKind, servicesLabel } from "./presta";
import { TZ } from "./format";
import { getPdfStyle } from "./pdfStyle";

const fullDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);

/** PDF d'un devis (avec les informations de l'événement lié). */
export async function buildQuotePdf(quoteId: string) {
  const q = await db.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { client: true, dossier: true } });
  const d = q.dossier;
  const pdf = await quoteToPdf(
    {
      label: q.label, number: q.number, issuedAt: q.issuedAt, validUntil: q.validUntil, lines: parseLines(q.lines),
      discount: q.discount, depositPercent: q.depositPercent, notes: q.notes, client: q.client,
      event: d ? {
        kind: eventKind(d.eventType).label,
        date: d.eventStart ? fullDate(d.eventStart) : "date à définir",
        venue: [d.venueName, d.venueAddress, d.venueCity].filter(Boolean).join(", "),
        guests: d.guests, services: servicesLabel(d.services),
      } : null,
    },
    await getCompany(),
    await getLogo(),
    await getPdfStyle(),
  );
  return { pdf, fileName: `devis-${q.number ?? q.id}.pdf`, quote: q };
}
