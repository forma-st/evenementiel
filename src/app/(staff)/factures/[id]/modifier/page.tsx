import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getCompany } from "@/lib/company";
import { quoteFormData } from "@/lib/quoteForm";
import { parseLines } from "@/lib/quotes";
import { QuoteEditor } from "@/components/QuoteEditor";
import { Back, PageHeader } from "@/components/ui";
import { saveInvoice } from "../../actions";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  await pagePerm(await requireStaff(), "canCreateQuotes");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv) notFound();
  if (inv.status !== "BROUILLON") redirect(`/factures/${id}`);
  const [data, c] = await Promise.all([quoteFormData(), getCompany()]);
  return (
    <div className="max-w-5xl">
      <Back href={`/factures/${id}`}>Brouillon</Back>
      <PageHeader title="Modifier le brouillon de facture" />
      <QuoteEditor mode="invoice" action={saveInvoice.bind(null, id)} {...data} vatExempt={c.vatExempt}
        initial={{ label: inv.label, clientId: inv.clientId, dossierId: inv.dossierId ?? undefined, discount: inv.discount, notes: inv.notes, lines: parseLines(inv.lines).map((l) => ({ ...l, unit: l.unit ?? "forfait" })), dueDate: day(inv.dueDate), serviceDate: day(inv.serviceDate), isNew: false }} />
    </div>
  );
}
