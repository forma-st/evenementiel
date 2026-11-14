import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { clientWhere, dossierWhere, pagePerm } from "@/lib/permissions";
import { SignatureRequestForm } from "@/components/SignatureRequestForm";
import { Back, PageHeader } from "@/components/ui";
import { eur } from "@/lib/format";

export const metadata = { title: "Nouvelle demande de signature" };

export default async function NewSignature({ searchParams }: { searchParams: Promise<{ clientId?: string; dossierId?: string; quoteId?: string }> }) {
  const user = await requireStaff();
  const perms = await pagePerm(user, "canSendSignatures");
  const sp = await searchParams;
  const [clients, dossiers, quotes] = await Promise.all([
    db.client.findMany({ where: clientWhere(user, perms), select: { id: true, name: true, email: true, contacts: { select: { firstName: true, lastName: true, email: true, jobTitle: true } } }, orderBy: { name: "asc" } }),
    db.dossier.findMany({ where: dossierWhere(user, perms), select: { id: true, reference: true, title: true, clientId: true }, orderBy: { createdAt: "desc" } }),
    db.quote.findMany({ where: { status: { notIn: ["REFUSE"] }, client: clientWhere(user, perms) }, select: { id: true, label: true, number: true, totalHT: true, clientId: true, dossierId: true }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  let defaults = { clientId: sp.clientId, dossierId: sp.dossierId, quoteId: sp.quoteId };
  if (sp.quoteId) {
    const q = quotes.find((x) => x.id === sp.quoteId);
    if (q) defaults = { clientId: q.clientId, dossierId: q.dossierId ?? sp.dossierId, quoteId: q.id };
  }
  return (
    <div className="max-w-3xl">
      <Back href="/signatures">Signatures</Back>
      <PageHeader title="Nouvelle demande de signature" subtitle="Signature électronique simple (eIDAS) avec dossier de preuve." />
      <SignatureRequestForm
        clients={clients}
        dossiers={dossiers.map((d) => ({ id: d.id, clientId: d.clientId, label: `${d.reference} — ${d.title}` }))}
        quotes={quotes.map((q) => ({ id: q.id, clientId: q.clientId, dossierId: q.dossierId, label: `${q.number ?? "Devis"} — ${q.label} (${eur(q.totalHT)} HT)` }))}
        defaults={defaults}
      />
    </div>
  );
}
