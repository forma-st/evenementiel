import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { clientWhere, permsFor } from "@/lib/permissions";
import { MAX_PDF_BYTES, assertPdf, sha256, signerToken } from "@/lib/signature";
import { buildQuotePdf } from "@/lib/quotePdf";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Création d'une demande de signature (formulaire multipart : PDF déposé ou devis du CRM). */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "CLIENT") return bad("Non autorisé", 401);
  const perms = await permsFor(user);
  if (!perms.canSendSignatures) return bad("Vous n'avez pas le droit d'envoyer des documents à signer.", 403);

  const f = await req.formData();
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const clientId = s("clientId");
  if (!clientId || !(await db.client.count({ where: { id: clientId, ...clientWhere(user, perms) } }))) return bad("Client introuvable.");
  const dossierId = s("dossierId") || null;
  const names = f.getAll("signerName").map(String);
  const emails = f.getAll("signerEmail").map(String);
  const signers = names.map((name, i) => ({ name: name.trim(), email: emails[i]?.trim() || null })).filter((x) => x.name);
  if (!signers.length) return bad("Ajoutez au moins un signataire.");

  let pdf: Buffer, fileName: string, quoteId: string | null = null, title = s("title");
  if (s("source") === "quote") {
    const q = await db.quote.findFirst({ where: { id: s("quoteId"), clientId }, include: { client: true } });
    if (!q) return bad("Devis introuvable pour ce client.");
    const b = await buildQuotePdf(q.id);
    pdf = b.pdf;
    fileName = b.fileName;
    quoteId = q.id;
    title ||= `Devis ${q.number ?? ""} — ${q.label}`.trim();
  } else {
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) return bad("Choisissez un fichier PDF.");
    if (file.size > MAX_PDF_BYTES) return bad("Le PDF dépasse 4 Mo.");
    pdf = Buffer.from(await file.arrayBuffer());
    try { await assertPdf(pdf); } catch { return bad("Ce fichier n'est pas un PDF valide (ou il est protégé par un mot de passe)."); }
    fileName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "document.pdf";
    title ||= fileName.replace(/\.pdf$/i, "");
  }

  const days = Math.min(90, Math.max(1, Number(s("expiresInDays")) || 30));
  const r = await db.signatureRequest.create({
    data: {
      title, message: s("message") || null, clientId, dossierId, quoteId, createdById: user.id,
      fileName, original: new Uint8Array(pdf), originalHash: sha256(pdf), winOnSign: f.get("winOnSign") === "on" && !!dossierId,
      expiresAt: new Date(Date.now() + days * 864e5), kind: quoteId ? "DEVIS" : "DOCUMENT",
      signers: { create: signers.map((x) => ({ ...x, token: signerToken() })) },
    },
  });
  if (dossierId) await db.activity.create({ data: { dossierId, userId: user.id, kind: "QUOTE", body: `✍ « ${title} » envoyé en signature à ${signers.map((x) => x.name).join(", ")}` } });
  if (quoteId) await db.quote.updateMany({ where: { id: quoteId, status: "BROUILLON" }, data: { status: "ENVOYE", sentAt: new Date() } });
  return NextResponse.json({ id: r.id });
}
