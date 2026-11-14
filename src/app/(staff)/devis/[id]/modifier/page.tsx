import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getCompany } from "@/lib/company";
import { quoteFormData } from "@/lib/quoteForm";
import { parseLines } from "@/lib/quotes";
import { QuoteEditor } from "@/components/QuoteEditor";
import { Back, PageHeader } from "@/components/ui";
import { saveQuote } from "../../actions";

export default async function EditQuote({ params }: { params: Promise<{ id: string }> }) {
  await pagePerm(await requireStaff(), "canCreateQuotes");
  const { id } = await params;
  const q = await db.quote.findUnique({ where: { id } });
  if (!q) notFound();
  const [data, company] = await Promise.all([quoteFormData(), getCompany()]);
  return (
    <div className="max-w-5xl">
      <Back href={`/devis/${id}`}>{q.number ?? "Devis"}</Back>
      <PageHeader title={`Modifier le devis ${q.number ?? ""}`} />
      <QuoteEditor
        action={saveQuote.bind(null, id)}
        {...data}
        vatExempt={company.vatExempt}
        initial={{
          label: q.label, clientId: q.clientId, dossierId: q.dossierId ?? undefined, discount: q.discount, depositPercent: q.depositPercent, notes: q.notes,
          lines: parseLines(q.lines).map((l) => ({ ...l, unit: l.unit ?? "forfait" })), validUntil: q.validUntil.toISOString().slice(0, 10), isNew: false,
        }}
      />
    </div>
  );
}
