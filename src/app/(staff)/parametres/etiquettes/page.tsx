import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { permsFor } from "@/lib/permissions";
import { TAG_COLORS, tagColor } from "@/lib/tags";
import { ResultForm } from "@/components/ResultForm";
import { Card, Empty } from "@/components/ui";
import { createTag, deleteTag, updateTag } from "../actions";

export const metadata = { title: "Étiquettes" };

function ColorSelect({ value }: { value?: string }) {
  return (
    <select name="color" defaultValue={value ?? "blue"} className="input w-36">
      {Object.entries(TAG_COLORS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
    </select>
  );
}

export default async function Tags() {
  const u = await requireStaff();
  if (!(await permsFor(u)).canManageTags) redirect("/parametres/compte");
  const tags = await db.tag.findMany({ include: { _count: { select: { clients: true } } }, orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <Card title="Nouvelle étiquette">
        <ResultForm action={createTag} submit="Ajouter" className="flex flex-wrap items-center gap-3 space-y-0">
          <input name="name" placeholder="Ex. : Mariage, Entreprise, Partenaire, VIP…" required className="input max-w-xs" />
          <ColorSelect />
        </ResultForm>
      </Card>
      <Card title={`Étiquettes (${tags.length})`}>
        {tags.length === 0 ? <Empty>Aucune étiquette.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {tags.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className={`badge ring-1 ${tagColor(t.color).chip}`}>{t.name}</span>
                <span className="text-xs text-slate-500">{t._count.clients} client(s)</span>
                <form action={updateTag.bind(null, t.id)} className="ml-auto flex flex-wrap gap-2">
                  <input name="name" defaultValue={t.name} className="input w-48 py-1.5" />
                  <ColorSelect value={t.color} />
                  <button className="btn-secondary py-1.5">Renommer</button>
                </form>
                <form action={deleteTag.bind(null, t.id)}>
                  <button className="px-2 text-xs text-slate-400 hover:text-brand-600">Supprimer</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
