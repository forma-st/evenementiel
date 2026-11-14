import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { Back, Card, PageHeader } from "@/components/ui";
import { MERGE_VARIABLES } from "@/lib/merge";
import { SERVICES, parseServices } from "@/lib/presta";
import { VariablesHelp } from "@/components/VariablesHelp";
import { saveTemplate } from "../actions";

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  await pagePerm(await requireStaff(), "canSendSignatures");
  const { id } = await params;
  const t = await db.contractTemplate.findUnique({ where: { id } });
  if (!t) notFound();
  const sv = parseServices(t.services);
  return (
    <div className="space-y-6">
      <Back href="/contrats">Contrats</Back>
      <PageHeader title={t.name} subtitle="Mise en forme : « # Titre », « ## Article », « - puce », « **ligne en gras** ». Les variables {{…}} sont remplacées à la génération." />
      <form action={saveTemplate.bind(null, id)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="card space-y-4 p-6">
            <label className="block"><span className="label">Nom du modèle</span><input name="name" defaultValue={t.name} className="input" /></label>
            <div>
              <span className="label">Suggéré pour les prestations</span>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((x) => (
                  <label key={x.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm">
                    <input type="checkbox" name="services" value={x.id} defaultChecked={sv.includes(x.id)} className="accent-brand-600" /> {x.icon} {x.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="attachQuote" defaultChecked={t.attachQuote} className="h-4 w-4 accent-brand-600" /> Joindre le devis accepté en annexe</label>
          </div>
          <textarea name="body" defaultValue={t.body} rows={36} className="input font-mono text-[13px] leading-relaxed" />
          <button className="btn-primary">Enregistrer le modèle</button>
        </div>
        <Card title="Variables" className="h-fit lg:sticky lg:top-6">
          <p className="mb-2 text-xs text-slate-500">Cliquez pour copier, puis collez dans le texte.</p>
          <div className="max-h-[70vh] overflow-y-auto"><VariablesHelp vars={MERGE_VARIABLES} /></div>
        </Card>
      </form>
    </div>
  );
}
