import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import type { Company } from "./company";
import { date } from "./format";
import { type QuoteLine, depositOf, totals, unitLabel } from "./quotes";

export const ACCENT = rgb(0.427, 0.157, 0.851);
export const INK = rgb(0.118, 0.106, 0.18);
export const MUTED = rgb(0.44, 0.44, 0.48);
export const LINE = rgb(0.86, 0.86, 0.88);
export const A4: [number, number] = [595.28, 841.89];

/** Les polices standard PDF (WinAnsi) ne couvrent pas tous les caractères : on remplace les autres. */
export const clean = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/[  ]/g, " ").replace(/[^\x20-\x7E -ÿŒœŠšŸŽž€\n]/g, "");

export const eurPdf = (n: number) => clean(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n));

export function wrap(text: string, font: PDFFont, size: number, max: number) {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > max && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export type Fonts = { font: PDFFont; bold: PDFFont; italic: PDFFont };
export async function fonts(doc: PDFDocument): Promise<Fonts> {
  return {
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
}

async function embedLogo(doc: PDFDocument, logo: string | null): Promise<PDFImage | null> {
  if (!logo) return null;
  try {
    const b = Buffer.from(logo.split(",")[1] ?? "", "base64");
    return logo.startsWith("data:image/png") ? await doc.embedPng(b) : await doc.embedJpg(b);
  } catch {
    return null;
  }
}

/** En-tête : logo (ou nom) à gauche, coordonnées à droite. Renvoie la hauteur occupée. */
export async function drawHeader(doc: PDFDocument, page: PDFPage, f: Fonts, c: Company, logo: string | null) {
  const { width, height } = page.getSize();
  const img = await embedLogo(doc, logo);
  if (img) {
    const s = Math.min(170 / img.width, 48 / img.height);
    page.drawImage(img, { x: 50, y: height - 40 - img.height * s, width: img.width * s, height: img.height * s });
  } else {
    page.drawText(clean(c.name), { x: 50, y: height - 62, size: 17, font: f.bold, color: ACCENT });
    if (c.tagline) page.drawText(clean(c.tagline), { x: 50, y: height - 76, size: 8.5, font: f.font, color: MUTED });
  }
  const lines = [
    c.name, c.address,
    [c.siret && `SIRET ${c.siret}`, c.vat && `TVA ${c.vat}`].filter(Boolean).join(" - "),
    [c.phone, c.email].filter(Boolean).join(" - "),
    c.web,
  ].filter(Boolean);
  lines.forEach((l, i) => {
    const ft = i === 0 ? f.bold : f.font;
    const size = i === 0 ? 10 : 8;
    const t = clean(l);
    page.drawText(t, { x: width - 50 - ft.widthOfTextAtSize(t, size), y: height - 50 - i * 11, size, font: ft, color: i === 0 ? INK : MUTED });
  });
}

export function drawFooter(page: PDFPage, f: Fonts, c: Company, text?: string) {
  const t = clean(text ?? [c.name, c.legal, c.address, c.siret && `SIRET ${c.siret}`].filter(Boolean).join(" - "));
  page.drawText(t.slice(0, 150), { x: 50, y: 28, size: 7, font: f.font, color: MUTED });
}

/* ---------- Devis ---------- */

export type QuotePdfInput = {
  label: string; number: string | null; issuedAt: Date; validUntil: Date; lines: QuoteLine[]; discount: number; depositPercent: number; notes: string | null;
  client: { name: string; address: string | null; postalCode: string | null; city: string | null; email: string | null; phone: string | null; siren?: string | null };
  event?: { kind: string; date: string; venue: string; guests: number | null; services: string } | null;
};

export async function quoteToPdf(q: QuotePdfInput, c: Company, logo: string | null) {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`Devis ${q.number ?? ""} - ${q.label}`));
  doc.setProducer(clean(c.name));
  const f = await fonts(doc);
  let page = doc.addPage(A4);
  const { width, height } = page.getSize();
  await drawHeader(doc, page, f, c, logo);

  let y = height - 135;
  page.drawText(clean(`DEVIS ${q.number ?? ""}`), { x: 50, y, size: 20, font: f.bold, color: ACCENT });
  page.drawText(clean(`Émis le ${date(q.issuedAt)} - valable jusqu'au ${date(q.validUntil)}`), { x: 50, y: y - 18, size: 9, font: f.font, color: MUTED });
  const cl = [q.client.name, q.client.address, [q.client.postalCode, q.client.city].filter(Boolean).join(" "), q.client.email, q.client.phone].filter(Boolean) as string[];
  page.drawRectangle({ x: width - 250, y: y - 74, width: 200, height: 92, color: rgb(0.965, 0.96, 0.985) });
  cl.forEach((l, i) => page.drawText(clean(l).slice(0, 40), { x: width - 240, y: y + 2 - i * 13, size: i === 0 ? 10 : 9, font: i === 0 ? f.bold : f.font, color: INK }));

  y -= 100;
  page.drawText(clean(q.label), { x: 50, y, size: 12, font: f.bold, color: INK });
  y -= 16;
  if (q.event) {
    const ev = [`${q.event.kind} - ${q.event.date}`, q.event.venue, [q.event.guests ? `${q.event.guests} invités` : "", q.event.services].filter(Boolean).join(" - ")].filter(Boolean);
    for (const l of ev) { page.drawText(clean(l), { x: 50, y, size: 9, font: f.font, color: MUTED }); y -= 12; }
  }
  y -= 12;

  const cols = [50, 330, 385, 455, 0];
  const head = () => {
    page.drawRectangle({ x: 45, y: y - 6, width: width - 90, height: 20, color: INK });
    ["Désignation", "Qté", "PU HT", c.vatExempt ? "" : "TVA", "Total HT"].forEach((h, i) => {
      const t = clean(h);
      const x = i === 4 ? width - 50 - f.bold.widthOfTextAtSize(t, 9) : cols[i];
      page.drawText(t, { x, y, size: 9, font: f.bold, color: rgb(1, 1, 1) });
    });
    y -= 24;
  };
  head();
  for (const l of q.lines) {
    const label = wrap(l.label, f.bold, 9, 270);
    const desc = l.description ? wrap(l.description, f.font, 8, 270) : [];
    const h = 11 * label.length + 10 * desc.length + 8;
    if (y - h < 120) {
      drawFooter(page, f, c);
      page = doc.addPage(A4);
      y = height - 60;
      head();
    }
    label.forEach((t, k) => page.drawText(t, { x: cols[0], y: y - k * 11, size: 9, font: f.bold, color: INK }));
    desc.forEach((t, k) => page.drawText(t, { x: cols[0], y: y - label.length * 11 - k * 10, size: 8, font: f.font, color: MUTED }));
    const qty = clean(`${l.quantity}${l.unit && l.unit !== "piece" ? " " + unitLabel(l.unit).toLowerCase() : ""}`);
    page.drawText(qty, { x: cols[1], y, size: 9, font: f.font });
    page.drawText(eurPdf(l.unitPrice), { x: cols[2], y, size: 9, font: f.font });
    if (!c.vatExempt) page.drawText(`${l.vatRate} %`, { x: cols[3], y, size: 9, font: f.font });
    const tot = eurPdf(l.quantity * l.unitPrice);
    page.drawText(tot, { x: width - 50 - f.font.widthOfTextAtSize(tot, 9), y, size: 9, font: f.font });
    y -= h;
    page.drawLine({ start: { x: 45, y: y + 11 }, end: { x: width - 45, y: y + 11 }, thickness: 0.5, color: LINE });
  }

  if (y < 230) { drawFooter(page, f, c); page = doc.addPage(A4); y = height - 60; }
  y -= 8;
  const t = totals(q.lines, q.discount);
  const rows: [string, string, boolean][] = [];
  if (q.discount > 0) { rows.push(["Sous-total HT", eurPdf(t.grossHT), false]); rows.push(["Remise", "- " + eurPdf(q.discount), false]); }
  if (c.vatExempt) rows.push(["Total net", eurPdf(t.totalHT), true]);
  else rows.push(["Total HT", eurPdf(t.totalHT), false], ["TVA", eurPdf(t.vat), false], ["Total TTC", eurPdf(t.totalTTC), true]);
  for (const [k, v, b] of rows) {
    const ft = b ? f.bold : f.font;
    const size = b ? 12 : 9;
    page.drawText(clean(k), { x: 360, y, size, font: ft, color: b ? ACCENT : INK });
    page.drawText(v, { x: width - 50 - ft.widthOfTextAtSize(v, size), y, size, font: ft, color: b ? ACCENT : INK });
    y -= b ? 20 : 14;
  }
  if (c.vatExempt) { page.drawText(clean("TVA non applicable, art. 293 B du CGI"), { x: 360, y, size: 8, font: f.italic, color: MUTED }); y -= 14; }

  const total = c.vatExempt ? t.totalHT : t.totalTTC;
  if (q.depositPercent > 0) {
    y -= 6;
    page.drawRectangle({ x: 45, y: y - 30, width: width - 90, height: 40, color: rgb(0.965, 0.96, 0.985) });
    page.drawText(clean(`Acompte à la réservation : ${q.depositPercent} % soit ${eurPdf(depositOf(total, q.depositPercent))}`), { x: 55, y: y - 4, size: 9.5, font: f.bold, color: INK });
    page.drawText(clean(`Solde : ${eurPdf(total - depositOf(total, q.depositPercent))}, à régler au plus tard 7 jours avant la prestation.`), { x: 55, y: y - 19, size: 8.5, font: f.font, color: MUTED });
    y -= 48;
  }
  const notes = [q.notes, c.quoteFooter, c.iban && `Règlement par virement - IBAN ${c.iban}${c.bic ? ` - BIC ${c.bic}` : ""}`].filter(Boolean).join("\n");
  for (const l of wrap(notes, f.font, 8.5, width - 100)) {
    if (y < 60) { drawFooter(page, f, c); page = doc.addPage(A4); y = height - 60; }
    page.drawText(l, { x: 50, y, size: 8.5, font: f.font, color: MUTED });
    y -= 11;
  }
  y -= 12;
  if (y > 70) page.drawText(clean("Bon pour accord : date et signature précédées de la mention « lu et approuvé »."), { x: 50, y, size: 8.5, font: f.italic, color: INK });
  drawFooter(page, f, c);
  return Buffer.from(await doc.save());
}

/* ---------- Contrat (texte avec titres « # », « ## » et puces « - ») ---------- */

export async function textToPdf(title: string, body: string, c: Company, logo: string | null, annex?: Uint8Array | null) {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(title));
  doc.setProducer(clean(c.name));
  const f = await fonts(doc);
  let page = doc.addPage(A4);
  const { width, height } = page.getSize();
  await drawHeader(doc, page, f, c, logo);
  let y = height - 130;
  const maxW = width - 100;
  const newPage = () => { drawFooter(page, f, c); page = doc.addPage(A4); y = height - 60; };

  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { y -= 7; continue; }
    let font = f.font, size = 9.5, color = INK, indent = 0, gapBefore = 0, gapAfter = 3, text = line, bullet = false;
    if (line.startsWith("# ")) { font = f.bold; size = 16; color = ACCENT; text = line.slice(2); gapBefore = 4; gapAfter = 8; }
    else if (line.startsWith("## ")) { font = f.bold; size = 11; text = line.slice(3); gapBefore = 8; gapAfter = 4; }
    else if (/^\s*[-•] /.test(line)) { bullet = true; indent = 14; text = line.replace(/^\s*[-•] /, ""); }
    else if (/^\*\*.*\*\*$/.test(line.trim())) { font = f.bold; text = line.trim().slice(2, -2); }
    const lines = wrap(text, font, size, maxW - indent);
    y -= gapBefore;
    if (y - lines.length * (size + 3) < 50) newPage();
    lines.forEach((l, i) => {
      if (bullet && i === 0) page.drawText("-", { x: 52, y, size, font, color: ACCENT });
      page.drawText(l, { x: 50 + indent, y, size, font, color });
      y -= size + 3;
      if (y < 50) newPage();
    });
    y -= gapAfter;
  }
  drawFooter(page, f, c);
  if (annex) {
    try {
      const a = await PDFDocument.load(annex);
      const pages = await doc.copyPages(a, a.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
    } catch {
      /* annexe illisible : ignorée */
    }
  }
  const n = doc.getPageCount();
  doc.getPages().forEach((p, i) => p.drawText(`${i + 1}/${n}`, { x: width - 70, y: 28, size: 7, font: f.font, color: MUTED }));
  return Buffer.from(await doc.save());
}

/* ---------- Facture / avoir ---------- */

type Party = { name: string; address: string; postalCode: string; city: string; siren: string; siret: string; vat: string; email: string; isCompany: boolean };

export async function invoiceToPdf(inv: {
  kind: string; kindLabel: string; number: string; draft: boolean; issueDate: Date; dueDate: Date | null; serviceDate: Date | null; label: string;
  lines: QuoteLine[]; discount: number; deducted: number; notes: string | null; seller: Party; buyer: Party; vatExempt: boolean; quoteNumber: string | null; event: string | null; credited: string | null;
}, c: Company, logo: string | null) {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`${inv.kindLabel} ${inv.number}`));
  doc.setProducer(clean(c.name));
  doc.setCreator(clean(c.name));
  const f = await fonts(doc);
  let page = doc.addPage(A4);
  const { width, height } = page.getSize();
  await drawHeader(doc, page, f, c, logo);
  if (inv.draft) page.drawText("BROUILLON", { x: 150, y: 380, size: 90, font: f.bold, color: rgb(0.93, 0.93, 0.95), rotate: degrees(35) });

  let y = height - 135;
  page.drawText(clean(`${inv.kindLabel.toUpperCase()} ${inv.draft ? "(brouillon)" : `N° ${inv.number}`}`), { x: 50, y, size: 17, font: f.bold, color: ACCENT });
  const meta = [`Date d'émission : ${date(inv.issueDate)}`, inv.serviceDate ? `Date de la prestation : ${date(inv.serviceDate)}` : null, inv.dueDate ? `Échéance : ${date(inv.dueDate)}` : "Payable à réception", inv.quoteNumber ? `Devis de référence : ${inv.quoteNumber}` : null, inv.credited ? `Avoir sur la facture ${inv.credited}` : null].filter(Boolean) as string[];
  meta.forEach((m, i) => page.drawText(clean(m), { x: 50, y: y - 18 - i * 12, size: 9, font: f.font, color: MUTED }));
  const b = inv.buyer;
  const bl = [b.name, b.address, [b.postalCode, b.city].filter(Boolean).join(" "), b.isCompany && b.siren ? `SIREN ${b.siren}` : null, b.vat ? `TVA ${b.vat}` : null].filter(Boolean) as string[];
  page.drawRectangle({ x: width - 250, y: y - 74, width: 200, height: 92, color: rgb(0.965, 0.96, 0.985) });
  page.drawText("Facturé à", { x: width - 240, y: y + 6, size: 7.5, font: f.font, color: MUTED });
  bl.forEach((l, i) => page.drawText(clean(l).slice(0, 42), { x: width - 240, y: y - 8 - i * 12, size: i === 0 ? 10 : 9, font: i === 0 ? f.bold : f.font, color: INK }));

  y -= 105;
  page.drawText(clean(inv.label), { x: 50, y, size: 11, font: f.bold, color: INK });
  y -= 14;
  page.drawText(clean(`Catégorie d'opération : prestation de services${inv.event ? ` - ${inv.event}` : ""}`), { x: 50, y, size: 8.5, font: f.font, color: MUTED });
  y -= 22;

  const cols = [50, 330, 385, 455];
  const head = () => {
    page.drawRectangle({ x: 45, y: y - 6, width: width - 90, height: 20, color: INK });
    ["Désignation", "Qté", "PU HT", inv.vatExempt ? "" : "TVA"].forEach((h, i) => page.drawText(clean(h), { x: cols[i], y, size: 9, font: f.bold, color: rgb(1, 1, 1) }));
    const t = "Total HT";
    page.drawText(t, { x: width - 50 - f.bold.widthOfTextAtSize(t, 9), y, size: 9, font: f.bold, color: rgb(1, 1, 1) });
    y -= 24;
  };
  head();
  for (const l of inv.lines) {
    const label = wrap(l.label, f.bold, 9, 270);
    const desc = l.description ? wrap(l.description, f.font, 8, 270) : [];
    const h = 11 * label.length + 10 * desc.length + 8;
    if (y - h < 150) { drawFooter(page, f, c); page = doc.addPage(A4); y = height - 60; head(); }
    label.forEach((t, k) => page.drawText(t, { x: cols[0], y: y - k * 11, size: 9, font: f.bold, color: INK }));
    desc.forEach((t, k) => page.drawText(t, { x: cols[0], y: y - label.length * 11 - k * 10, size: 8, font: f.font, color: MUTED }));
    page.drawText(clean(`${l.quantity}${l.unit && l.unit !== "piece" ? " " + unitLabel(l.unit).toLowerCase() : ""}`), { x: cols[1], y, size: 9, font: f.font });
    page.drawText(eurPdf(l.unitPrice), { x: cols[2], y, size: 9, font: f.font });
    if (!inv.vatExempt) page.drawText(`${l.vatRate} %`, { x: cols[3], y, size: 9, font: f.font });
    const tot = eurPdf(l.quantity * l.unitPrice);
    page.drawText(tot, { x: width - 50 - f.font.widthOfTextAtSize(tot, 9), y, size: 9, font: f.font });
    y -= h;
    page.drawLine({ start: { x: 45, y: y + 11 }, end: { x: width - 45, y: y + 11 }, thickness: 0.5, color: LINE });
  }
  if (y < 260) { drawFooter(page, f, c); page = doc.addPage(A4); y = height - 60; }
  y -= 8;
  const t = totals(inv.lines, inv.discount);
  const rows: [string, string, boolean][] = [];
  if (inv.discount > 0) rows.push(["Sous-total HT", eurPdf(t.grossHT), false], ["Remise", "- " + eurPdf(inv.discount), false]);
  rows.push([inv.vatExempt ? "Total" : "Total HT", eurPdf(t.totalHT), inv.vatExempt && !inv.deducted]);
  if (!inv.vatExempt) rows.push(["TVA", eurPdf(t.vat), false], ["Total TTC", eurPdf(t.totalTTC), !inv.deducted]);
  if (inv.deducted > 0) rows.push(["Acomptes déjà facturés", "- " + eurPdf(inv.deducted), false], ["Net à payer", eurPdf((inv.vatExempt ? t.totalHT : t.totalTTC) - inv.deducted), true]);
  for (const [k, v, bo] of rows) {
    const ft = bo ? f.bold : f.font, size = bo ? 12 : 9;
    page.drawText(clean(k), { x: 350, y, size, font: ft, color: bo ? ACCENT : INK });
    page.drawText(v, { x: width - 50 - ft.widthOfTextAtSize(v, size), y, size, font: ft, color: bo ? ACCENT : INK });
    y -= bo ? 20 : 14;
  }
  y -= 10;
  const legal = [
    inv.vatExempt ? "TVA non applicable, art. 293 B du CGI." : null,
    inv.notes,
    c.iban ? `Règlement par virement : IBAN ${c.iban}${c.bic ? ` - BIC ${c.bic}` : ""} - référence ${inv.number}.` : null,
    "Pas d'escompte pour paiement anticipé.",
    "En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal" + (inv.buyer.isCompany ? ", et indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce)." : "."),
  ].filter(Boolean).join("\n");
  for (const l of wrap(legal, f.font, 8, width - 100)) {
    if (y < 60) { drawFooter(page, f, c); page = doc.addPage(A4); y = height - 60; }
    page.drawText(l, { x: 50, y, size: 8, font: f.font, color: MUTED });
    y -= 10.5;
  }
  const s = inv.seller;
  drawFooter(page, f, c, [s.name, c.legal || "EI", [s.address, s.postalCode, s.city].filter(Boolean).join(" "), s.siret && `SIRET ${s.siret}`, s.vat && `TVA ${s.vat}`].filter(Boolean).join(" - "));
  return Buffer.from(await doc.save());
}
