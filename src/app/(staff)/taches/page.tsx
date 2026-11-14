import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { TaskBoard } from "@/components/TaskBoard";
import { PageHeader } from "@/components/ui";
import { TASK_TYPES, addDays, startOfDay, toRow } from "@/lib/tasks";
import { permsFor, taskWhere } from "@/lib/permissions";

export const metadata = { title: "Tâches" };

const FILTERS = [
  { id: "mes", label: "Mes tâches" },
  { id: "toutes", label: "Toute l'équipe" },
  { id: "retard", label: "En retard" },
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "semaine", label: "7 prochains jours" },
] as const;

export default async function TasksPage({ searchParams }: {
  searchParams: Promise<{ filtre?: string; vue?: string; assignee?: string; type?: string; q?: string; faites?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const filtre = sp.filtre ?? "mes";
  const vue = sp.vue === "kanban" ? "kanban" : "tableau";
  const today = startOfDay();
  const showDone = sp.faites === "1";

  const perms = await permsFor(user);
  const scope = taskWhere(user, perms);
  const where: Prisma.TaskWhereInput = {
    AND: [
      scope,
      filtre === "mes" ? { assigneeId: user.id } : {},
      filtre === "retard" ? { dueDate: { lt: today }, status: { not: "FAIT" } } : {},
      filtre === "aujourdhui" ? { dueDate: { gte: today, lt: addDays(today, 1) } } : {},
      filtre === "semaine" ? { dueDate: { gte: today, lt: addDays(today, 8) } } : {},
      sp.assignee ? { assigneeId: sp.assignee } : {},
      sp.type ? { type: sp.type } : {},
      sp.q ? { OR: [{ title: { contains: sp.q, mode: "insensitive" } }, { client: { name: { contains: sp.q, mode: "insensitive" } } }] } : {},
      // tâches faites : seulement les 30 derniers jours, et uniquement si demandé
      showDone ? { OR: [{ status: { not: "FAIT" } }, { completedAt: { gte: addDays(today, -30) } }] } : { status: { not: "FAIT" } },
    ],
  };

  const [tasks, users, clients, dossiers, counts] = await Promise.all([
    db.task.findMany({ where, include: { client: true, dossier: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.dossier.findMany({ where: { status: { notIn: ["CLOTURE", "PERDU"] } }, select: { id: true, reference: true, title: true, clientId: true }, orderBy: { createdAt: "desc" } }),
    Promise.all([
      db.task.count({ where: { assigneeId: user.id, status: { not: "FAIT" } } }),
      db.task.count({ where: { ...scope, status: { not: "FAIT" }, dueDate: { lt: today } } }),
      db.task.count({ where: { ...scope, status: { not: "FAIT" }, dueDate: { gte: today, lt: addDays(today, 1) } } }),
      db.task.count({ where: { ...scope, status: "FAIT", completedAt: { gte: addDays(today, -7) } } }),
    ]),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { filtre, vue, assignee: sp.assignee, type: sp.type, q: sp.q, faites: sp.faites, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/taches?${p}`;
  };
  const stats = [
    { label: "Mes tâches ouvertes", value: counts[0], href: qs({ filtre: "mes" }) },
    { label: perms.tasksScope === "all" ? "En retard (équipe)" : "En retard", value: counts[1], href: qs({ filtre: "retard" }), alert: counts[1] > 0 },
    { label: "À faire aujourd'hui", value: counts[2], href: qs({ filtre: "aujourdhui" }) },
    { label: "Terminées sur 7 jours", value: counts[3], href: qs({ filtre: "toutes", faites: "1" }) },
  ];

  return (
    <div>
      <PageHeader
        title="Tâches"
        subtitle="Cliquez sur une cellule pour la modifier, sur « Ouvrir » pour le détail."
        actions={
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            <Link href={qs({ vue: "tableau" })} className={`rounded-md px-3 py-1.5 ${vue === "tableau" ? "bg-slate-100 font-medium" : ""}`}>▦ Tableau</Link>
            <Link href={qs({ vue: "kanban" })} className={`rounded-md px-3 py-1.5 ${vue === "kanban" ? "bg-slate-100 font-medium" : ""}`}>▥ Kanban</Link>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`card px-4 py-3 hover:border-link-500 ${s.alert ? "border-l-4 border-l-brand-600" : ""}`}>
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className={`text-2xl font-semibold ${s.alert ? "text-brand-600" : ""}`}>{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.id} href={qs({ filtre: f.id })} className={`badge px-3 py-1.5 text-sm ${filtre === f.id ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {f.label}
          </Link>
        ))}
        <form className="ml-auto flex flex-wrap gap-2">
          <input type="hidden" name="filtre" value={filtre} />
          <input type="hidden" name="vue" value={vue} />
          {showDone && <input type="hidden" name="faites" value="1" />}
          <input name="q" defaultValue={sp.q} placeholder="Rechercher…" className="input w-44" />
          <select name="assignee" defaultValue={sp.assignee ?? ""} className="input w-44">
            <option value="">Tous responsables</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select name="type" defaultValue={sp.type ?? ""} className="input w-36">
            <option value="">Tous types</option>
            {TASK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button className="btn-secondary">Filtrer</button>
        </form>
      </div>
      <div className="mb-4 text-sm">
        <Link href={qs({ faites: showDone ? undefined : "1" })} className="text-link-600 hover:underline">
          {showDone ? "Masquer les tâches terminées" : "Afficher les tâches terminées (30 derniers jours)"}
        </Link>
      </div>

      <TaskBoard
        initial={tasks.map(toRow)}
        users={perms.canAssignOthers ? users : users.filter((u) => u.id === user.id)}
        clients={clients}
        dossiers={dossiers.map((d) => ({ id: d.id, clientId: d.clientId, label: `${d.reference} — ${d.title}` }))}
        view={vue}
        showDone={showDone}
      />
    </div>
  );
}
