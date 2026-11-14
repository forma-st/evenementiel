import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getCompany } from "@/lib/company";
import { quoteFormData } from "@/lib/quoteForm";
import { QuoteEditor } from "@/components/QuoteEditor";
import { Back, PageHeader } from "@/components/ui";
import { saveQuote } from "../actions";

export const metadata = { title: "Nouveau devis" };

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ clientId?: string; dossierId?: string }> }) {
  await pagePerm(await requireStaff(), "canCreateQuotes");
  const sp = await searchParams;
  const [data, company] = await Promise.all([quoteFormData(), getCompany()]);
  let clientId = sp.clientId;
  if (sp.dossierId && !clientId) clientId = (await db.dossier.findUnique({ where: { id: sp.dossierId }, select: { clientId: true } }))?.clientId;
  return (
    <div className="max-w-5xl">
      <Back href="/devis">Devis</Back>
      <PageHeader title="Nouveau devis" subtitle="Composez le devis à partir du catalogue : numéro, PDF et lien d'acceptation en ligne sont générés automatiquement." />
      <QuoteEditor action={saveQuote.bind(null, null)} {...data} vatExempt={company.vatExempt} initial={{ clientId, dossierId: sp.dossierId, isNew: true }} />
    </div>
  );
}
