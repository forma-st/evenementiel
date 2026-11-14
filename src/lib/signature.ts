import { createHash, randomBytes } from "crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getCompany, getLogo } from "./company";
import { dateTime, TZ } from "./format";
import { ACCENT, INK, LINE, MUTED, clean, drawHeader, wrap } from "./pdf";

export const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
export const signerToken = () => randomBytes(24).toString("base64url");
export const MAX_PDF_BYTES = 4 * 1024 * 1024; // limite des requêtes Vercel (4,5 Mo)

export const SIGNATURE_STATUSES: Record<string, { label: string; color: string }> = {
  EN_ATTENTE: { label: "En attente de signature", color: "bg-amber-100 text-amber-800" },
  SIGNE: { label: "Signé", color: "bg-emerald-100 text-emerald-700" },
  REFUSE: { label: "Refusé", color: "bg-red-100 text-red-700" },
  ANNULE: { label: "Annulé", color: "bg-slate-100 text-slate-600" },
};

const RED = ACCENT;

/* ---------- PDF signé + dossier de preuve ---------- */

type SignerProof = { name: string; email: string | null; signedAt: Date; ip: string | null; userAgent: string | null; signatureImage: string | null; viewedAt: Date | null };

export async function buildSignedPdf(r: { id: string; title: string; fileName: string; original: Uint8Array; originalHash: string; createdAt: Date; createdBy: string | null; clientName: string }, signers: SignerProof[]) {
  const COMPANY = await getCompany();
  const logo = await getLogo();
  const doc = await PDFDocument.load(r.original, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const total = doc.getPageCount() + 2;

  // mention en pied de chaque page d'origine
  doc.getPages().forEach((p, i) => {
    const t = clean(`Signé électroniquement - réf. ${r.id} - page ${i + 1}/${total}`);
    p.drawText(t, { x: 20, y: 10, size: 6.5, font, color: MUTED });
  });

  // page des signatures
  const sp = doc.addPage([595.28, 841.89]);
  const { width, height } = sp.getSize();
  await drawHeader(doc, sp, { font, bold, italic: font }, COMPANY, logo);
  let y = height - 140;
  sp.drawText(clean("Signatures"), { x: 50, y, size: 18, font: bold, color: RED });
  sp.drawText(clean(`Document : ${r.title} (${r.fileName})`), { x: 50, y: y - 20, size: 9, font, color: MUTED });
  y -= 60;
  for (const s of signers) {
    sp.drawRectangle({ x: 50, y: y - 110, width: width - 100, height: 120, borderColor: LINE, borderWidth: 1 });
    sp.drawText(clean(s.name), { x: 62, y: y - 8, size: 11, font: bold, color: INK });
    sp.drawText(clean(`${s.email ?? ""}  -  signé le ${dateTime(s.signedAt)} (heure de Paris)`), { x: 62, y: y - 22, size: 8.5, font, color: MUTED });
    sp.drawText(clean("Lu et approuvé, bon pour accord."), { x: 62, y: y - 36, size: 8.5, font, color: INK });
    if (s.signatureImage?.startsWith("data:image/png;base64,")) {
      const img = await doc.embedPng(Buffer.from(s.signatureImage.split(",")[1], "base64"));
      const scale = Math.min(220 / img.width, 66 / img.height);
      sp.drawImage(img, { x: width - 60 - img.width * scale, y: y - 104, width: img.width * scale, height: img.height * scale });
    }
    y -= 135;
    if (y < 140) break;
  }
  sp.drawText(clean(`Signé électroniquement - réf. ${r.id} - page ${total - 1}/${total}`), { x: 20, y: 10, size: 6.5, font, color: MUTED });

  // dossier de preuve
  const pp = doc.addPage([595.28, 841.89]);
  y = pp.getSize().height - 60;
  pp.drawText(clean("Dossier de preuve - signature électronique"), { x: 50, y, size: 15, font: bold, color: INK });
  y -= 18;
  for (const l of wrap("Signature électronique simple au sens du règlement (UE) n° 910/2014 (eIDAS) et de l'article 1367 du Code civil. Chaque signataire a accédé au document par un lien personnel et unique, en a pris connaissance, a coché la mention « lu et approuvé » puis a apposé sa signature manuscrite numérisée.", font, 8.5, width - 100)) {
    pp.drawText(l, { x: 50, y, size: 8.5, font, color: MUTED }); y -= 11;
  }
  y -= 10;
  const row = (k: string, v: string) => {
    const keys = wrap(k, bold, 8.5, 120);
    keys.forEach((t, i) => pp.drawText(t, { x: 50, y: y - i * 11, size: 8.5, font: bold, color: INK }));
    const lines = wrap(v, font, 8.5, width - 230);
    lines.forEach((t, i) => pp.drawText(t, { x: 180, y: y - i * 11, size: 8.5, font, color: INK }));
    y -= 11 * Math.max(lines.length, keys.length) + 4;
  };
  row("Référence", r.id);
  row("Document", `${r.title} - ${r.fileName}`);
  row("Client", r.clientName);
  row("Émis par", `${r.createdBy ?? "-"} (${COMPANY.name}) le ${dateTime(r.createdAt)}`);
  row("Empreinte SHA-256 du document d'origine", r.originalHash);
  row("Fuseau horaire", TZ);
  for (const [i, s] of signers.entries()) {
    y -= 8;
    pp.drawLine({ start: { x: 50, y: y + 6 }, end: { x: width - 50, y: y + 6 }, thickness: 0.5, color: LINE });
    y -= 6;
    row(`Signataire ${i + 1}`, `${s.name}${s.email ? ` <${s.email}>` : ""}`);
    row("Document consulté le", s.viewedAt ? dateTime(s.viewedAt) : "-");
    row("Signé le", dateTime(s.signedAt));
    row("Adresse IP", s.ip ?? "-");
    row("Navigateur", (s.userAgent ?? "-").slice(0, 220));
  }
  y -= 10;
  for (const l of wrap("L'empreinte SHA-256 du présent fichier signé est enregistrée dans le logiciel au moment de sa génération : toute modification ultérieure du fichier la rendrait différente.", font, 8, width - 100)) {
    pp.drawText(l, { x: 50, y, size: 8, font, color: MUTED }); y -= 10;
  }
  pp.drawText(clean(`Signé électroniquement - réf. ${r.id} - page ${total}/${total}`), { x: 20, y: 10, size: 6.5, font, color: MUTED });

  doc.setProducer(clean(`${COMPANY.name} - signature électronique`));
  doc.setModificationDate(new Date());
  const bytes = Buffer.from(await doc.save());
  return { bytes, hash: sha256(bytes) };
}

/** Vérifie qu'un fichier est bien un PDF lisible. */
export async function assertPdf(bytes: Uint8Array) {
  if (Buffer.from(bytes.slice(0, 5)).toString() !== "%PDF-") throw new Error("Le fichier n'est pas un PDF.");
  await PDFDocument.load(bytes, { ignoreEncryption: true });
}
