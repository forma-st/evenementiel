import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BulkEmailComposer } from "@/components/BulkEmailComposer";
import { EVENT_KINDS } from "@/lib/presta";
import { DOSSIER_STATUSES, dateTime } from "@/lib/format";
import { MERGE_VARIABLES } from "@/lib/merge";

export const metadata = { title: "E-mails groupés" };

export default async function BulkEmails() {
  await requireStaff();
  const [templates, history] = await Promise.all([
    db.emailTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, subject: true, body: true } }),
    db.bulkEmail.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const users = await db.user.findMany({ where: { id: { in: history.map((h) => h.createdById).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  return (
    <div className="space-y-8">
      <PageHeader title="E-mails groupés" subtitle="Écrivez une fois aux clients d'une sélection de prestations : rappel de saison, informations pratiques, demande d'avis, offre…" />
      <BulkEmailComposer
        kinds={EVENT_KINDS.filter((k) => k.id !== "PRET").map((k) => ({ id: k.id, label: k.label, icon: k.icon }))}
        statuses={DOSSIER_STATUSES.map((s) => ({ id: s.id, label: s.label }))}
        templates={templates}
        vars={MERGE_VARIABLES}
      />
      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Historique des envois</h2>
        {history.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">Aucun envoi groupé pour l&apos;instant.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{h.subject}</div>
                  <div className="text-xs text-slate-500">{dateTime(h.createdAt)} · {users.find((u) => u.id === h.createdById)?.name ?? "—"}</div>
                </div>
                <span className="badge bg-slate-100 text-slate-700">{h.recipients} destinataire{h.recipients > 1 ? "s" : ""}</span>
                {h.sent > 0 && <span className="badge bg-emerald-100 text-emerald-700">{h.sent} envoyé{h.sent > 1 ? "s" : ""}</span>}
                {h.simulated > 0 && <span className="badge bg-amber-100 text-amber-800">{h.simulated} simulé{h.simulated > 1 ? "s" : ""}</span>}
                {h.failed > 0 && <span className="badge bg-rose-100 text-rose-700">{h.failed} échec{h.failed > 1 ? "s" : ""}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
