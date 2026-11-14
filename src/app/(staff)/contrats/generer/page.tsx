import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible, pagePerm } from "@/lib/permissions";
import { Back, PageHeader } from "@/components/ui";
import { render, varsForDossier } from "@/lib/merge";
import { parseServices } from "@/lib/presta";
import { eur, quoteStatus } from "@/lib/format";
import { ContractForm } from "@/components/ContractForm";

export const metadata = { title: "Générer un contrat" };

export default async function GenerateContract({ searchParams }: { searchParams: Promise<{ dossierId?: string; templateId?: string }> }) {
  const user = await requireStaff();
  await pagePerm(user, "canSendSignatures");
  const sp = await searchParams;
  if (!sp.dossierId) notFound();
  await assertDossierVisible(user, sp.dossierId);
  const d = await db.dossier.findUnique({ where: { id: sp.dossierId }, include: { client: { include: { contacts: true } }, quotes: { where: { status: { not: "REFUSE" } }, orderBy: { createdAt: "desc" } } } });
  if (!d) notFound();
  const templates = await db.contractTemplate.findMany({ where: { archived: false }, orderBy: { name: "asc" } });
  if (!templates.length) return <div><Back href={`/prestations/${d.id}`}>{d.title}</Back><p className="text-sm">Aucun modèle : <Link href="/contrats" className="text-link-600">créez un modèle de contrat</Link>.</p></div>;

  const sv = parseServices(d.services);
  const score = (t: { services: string }) => parseServices(t.services).filter((x) => sv.includes(x)).length;
  const tpl = templates.find((t) => t.id === sp.templateId) ?? [...templates].sort((a, b) => score(b) - score(a))[0];
  const body = render(tpl.body, await varsForDossier(d.id));
  const quote = d.quotes.find((q) => q.status === "ACCEPTE") ?? d.quotes[0];
  const signers = [{ name: d.client.type === "COMPANY" && d.client.contacts[0] ? `${d.client.contacts[0].firstName} ${d.client.contacts[0].lastName}`.trim() : d.client.name, email: d.client.contacts[0]?.email ?? d.client.email ?? "" }];

  return (
    <div className="max-w-5xl space-y-4">
      <Back href={`/prestations/${d.id}`}>{d.title}</Back>
      <PageHeader title="Générer le contrat" subtitle={`${d.reference} · ${d.client.name}`} />
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <Link key={t.id} href={`/contrats/generer?dossierId=${d.id}&templateId=${t.id}`} className={`badge px-3 py-1.5 text-sm ${t.id === tpl.id ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{t.name}</Link>
        ))}
      </div>
      <ContractForm
        key={tpl.id}
        dossierId={d.id}
        templateId={tpl.id}
        title={tpl.name.replace(/^Contrat/i, "Contrat").concat(` — ${d.client.name}`)}
        body={body}
        quotes={d.quotes.map((q) => ({ id: q.id, label: `${q.number ?? "Devis"} — ${q.label} (${eur(q.totalTTC)} TTC, ${quoteStatus(q.status).label.toLowerCase()})` }))}
        defaultQuoteId={tpl.attachQuote ? quote?.id ?? "" : ""}
        signers={signers}
        hasUnfilled={/\{\{\s*[\w.]+\s*\}\}/.test(body)}
      />
    </div>
  );
}
