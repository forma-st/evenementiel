import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { getCompany } from "@/lib/company";
import { quoteFormData } from "@/lib/quoteForm";
import { QuoteEditor } from "@/components/QuoteEditor";
import { Back, PageHeader } from "@/components/ui";
import { saveInvoice } from "../actions";

export const metadata = { title: "Nouvelle facture" };

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ clientId?: string; dossierId?: string }> }) {
  await pagePerm(await requireStaff(), "canCreateQuotes");
  const sp = await searchParams;
  const [data, c] = await Promise.all([quoteFormData(), getCompany()]);
  return (
    <div className="max-w-5xl">
      <Back href="/factures">Factures</Back>
      <PageHeader title="Facture libre" subtitle="Pour une prestation facturée depuis un devis, utilisez plutôt les boutons « Facturer » de l'échéancier : acomptes et déductions sont calculés automatiquement." />
      <QuoteEditor mode="invoice" action={saveInvoice.bind(null, null)} {...data} vatExempt={c.vatExempt} initial={{ clientId: sp.clientId, dossierId: sp.dossierId, isNew: true }} />
    </div>
  );
}
