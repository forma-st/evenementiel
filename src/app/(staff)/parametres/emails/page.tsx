import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MERGE_VARIABLES } from "@/lib/merge";
import { VariablesHelp } from "@/components/VariablesHelp";
import { Card } from "@/components/ui";
import { isMailConfigured } from "@/lib/mail";
import { deleteEmailTemplate, saveEmailTemplate } from "./actions";

export const metadata = { title: "Modèles d'e-mails" };

function Form({ t }: { t?: { id: string; name: string; subject: string; body: string } }) {
  return (
    <form action={saveEmailTemplate.bind(null, t?.id ?? null)} className="space-y-2">
      <input name="name" defaultValue={t?.name} required placeholder="Nom du modèle" className="input" />
      <input name="subject" defaultValue={t?.subject} required placeholder="Objet" className="input" />
      <textarea name="body" defaultValue={t?.body} rows={10} required placeholder="Texte de l'e-mail" className="input font-mono text-[13px]" />
      <div className="flex gap-3">
        <button className="btn-primary">{t ? "Enregistrer" : "Créer le modèle"}</button>
        {t && <button formAction={deleteEmailTemplate.bind(null, t.id)} className="text-sm text-rose-600 hover:underline">Supprimer</button>}
      </div>
    </form>
  );
}

export default async function EmailTemplates() {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") redirect("/parametres");
  const list = await db.emailTemplate.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Utilisés par les automatisations et depuis la fiche prestation (« Écrire au client »). {isMailConfigured() ? "Envoi réel activé." : "Envoi en mode simulation : voir l'onglet Intégrations."}</p>
        {list.map((t) => (
          <details key={t.id} className="card p-4">
            <summary className="cursor-pointer font-medium">{t.name}<span className="ml-2 text-sm font-normal text-slate-500">— {t.subject}</span></summary>
            <div className="mt-3"><Form t={t} /></div>
          </details>
        ))}
        <details className="card p-4"><summary className="cursor-pointer font-medium text-link-600">+ Nouveau modèle</summary><div className="mt-3"><Form /></div></details>
      </div>
      <Card title="Variables" className="h-fit lg:sticky lg:top-6"><div className="max-h-[70vh] overflow-y-auto"><VariablesHelp vars={MERGE_VARIABLES} /></div></Card>
    </div>
  );
}
