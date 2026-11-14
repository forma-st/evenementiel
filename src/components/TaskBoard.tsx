"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createTask, deleteTask, updateTask } from "@/app/(staff)/taches/actions";
import {
  TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES, isOverdue, taskPriority, taskStatus, taskType, type TaskRow,
} from "@/lib/tasks";

type Opt = { id: string; name: string };
type DossierOpt = { id: string; label: string; clientId: string };
type Patch = Partial<TaskRow>;

export function TaskBoard({
  initial, users, clients = [], dossiers = [], view = "tableau", context, showDone = true,
}: {
  initial: TaskRow[];
  users: Opt[];
  clients?: Opt[];
  dossiers?: DossierOpt[];
  view?: "tableau" | "kanban";
  /** Tâches affichées dans une fiche dossier / client : liens pré-remplis. */
  context?: { clientId?: string; dossierId?: string };
  showDone?: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => setRows(initial), [initial]);

  const [error, setError] = useState<string | null>(null);
  const fail = (snapshot: TaskRow[]) => {
    setRows(snapshot);
    setError("Action refusée : vous n'avez peut-être pas les droits nécessaires. La modification a été annulée.");
    setTimeout(() => setError(null), 6000);
  };
  const update = (id: string, patch: Patch) => {
    const snapshot = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    start(async () => {
      try {
        const fresh = await updateTask(id, patch);
        setRows((rs) => rs.map((r) => (r.id === id ? fresh : r)));
      } catch {
        fail(snapshot);
      }
    });
  };
  const add = (patch: Patch) =>
    start(async () => {
      try {
        const t = await createTask({ ...patch, clientId: context?.clientId, dossierId: context?.dossierId });
        setRows((rs) => [...rs, t]);
      } catch {
        fail(rows);
      }
    });
  const remove = (id: string) => {
    const snapshot = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    setOpenId(null);
    start(async () => {
      try {
        await deleteTask(id);
      } catch {
        fail(snapshot);
      }
    });
  };

  const open = rows.find((r) => r.id === openId) ?? null;
  const showLinks = !context?.dossierId;
  const statuses = showDone ? TASK_STATUSES : TASK_STATUSES.filter((s) => s.id !== "FAIT");

  return (
    <>
      {error && <div className="mb-3 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">{error}</div>}
      {view === "kanban" ? (
        <Kanban rows={rows} users={users} statuses={statuses} onUpdate={update} onOpen={setOpenId} onAdd={add} />
      ) : (
        <div className="space-y-6">
          {statuses.map((s) => (
            <Group
              key={s.id}
              status={s}
              rows={rows.filter((r) => r.status === s.id)}
              users={users}
              showLinks={showLinks}
              defaultCollapsed={s.id === "FAIT"}
              onUpdate={update}
              onOpen={setOpenId}
              onAdd={(title) => add({ title, status: s.id })}
            />
          ))}
        </div>
      )}
      {open && (
        <Drawer
          task={open}
          users={users}
          clients={clients}
          dossiers={dossiers}
          lockLinks={!!context}
          onClose={() => setOpenId(null)}
          onUpdate={(p) => update(open.id, p)}
          onDelete={() => remove(open.id)}
        />
      )}
    </>
  );
}

/* ---------------- Vue tableau (groupes par statut) ---------------- */

function Group({ status, rows, users, showLinks, defaultCollapsed, onUpdate, onOpen, onAdd }: {
  status: (typeof TASK_STATUSES)[number];
  rows: TaskRow[];
  users: Opt[];
  showLinks: boolean;
  defaultCollapsed: boolean;
  onUpdate: (id: string, p: Patch) => void;
  onOpen: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [draft, setDraft] = useState("");
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    [rows],
  );
  return (
    <section>
      <button onClick={() => setCollapsed((c) => !c)} className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className={`inline-block transition ${collapsed ? "-rotate-90" : ""}`}>▾</span>
        <span className={`h-3 w-3 rounded-full ${status.dot}`} />
        {status.label}
        <span className="font-normal text-slate-400">{rows.length}</span>
      </button>
      {!collapsed && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className={`w-1.5 p-0 ${status.dot}`} />
                <th className="w-9 py-2" />
                <th className="py-2 pr-2 font-medium">Tâche</th>
                <th className="w-28 px-2 py-2 font-medium">Type</th>
                <th className="w-40 px-2 py-2 font-medium">Responsable</th>
                <th className="w-28 px-2 py-2 text-center font-medium">Statut</th>
                <th className="w-36 px-2 py-2 font-medium">Échéance</th>
                <th className="w-24 px-2 py-2 text-center font-medium">Priorité</th>
                {showLinks && <th className="w-48 px-2 py-2 font-medium">Lié à</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <Row key={t.id} t={t} users={users} showLinks={showLinks} bar={status.dot} onUpdate={onUpdate} onOpen={onOpen} />
              ))}
              <tr className="border-t border-slate-100">
                <td className={`p-0 ${status.dot} opacity-40`} />
                <td />
                <td colSpan={showLinks ? 7 : 6} className="py-1.5 pr-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!draft.trim()) return;
                      onAdd(draft.trim());
                      setDraft("");
                    }}
                  >
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="+ Ajouter une tâche (Entrée pour valider)"
                      className="w-full rounded-md px-2 py-1.5 outline-none placeholder:text-slate-400 hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-link-100"
                    />
                  </form>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({ t, users, showLinks, bar, onUpdate, onOpen }: {
  t: TaskRow; users: Opt[]; showLinks: boolean; bar: string;
  onUpdate: (id: string, p: Patch) => void; onOpen: (id: string) => void;
}) {
  const [title, setTitle] = useState(t.title);
  useEffect(() => setTitle(t.title), [t.title]);
  const done = t.status === "FAIT";
  const late = isOverdue(t);
  return (
    <tr className="group border-t border-slate-100 hover:bg-slate-50/70">
      <td className={`p-0 ${bar}`} />
      <td className="text-center">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => onUpdate(t.id, { status: e.target.checked ? "FAIT" : "A_FAIRE" })}
          className="h-4 w-4 accent-emerald-600"
          aria-label="Marquer comme fait"
        />
      </td>
      <td className="py-1 pr-2">
        <div className="relative">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== t.title && onUpdate(t.id, { title })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={`w-full truncate rounded-md py-1.5 pr-16 pl-2 outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-link-100 ${done ? "text-slate-400 line-through" : ""}`}
            title={t.title}
          />
          <button onClick={() => onOpen(t.id)} className={`absolute top-1/2 right-1 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 ${t.description ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`} title="Ouvrir le détail">
            {t.description ? "✎ " : ""}Ouvrir
          </button>
        </div>
      </td>
      <td className="px-2">
        <select value={t.type} onChange={(e) => onUpdate(t.id, { type: e.target.value })} className="w-full rounded-md bg-transparent px-1 py-1.5 outline-none hover:bg-white">
          {TASK_TYPES.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.label}</option>)}
        </select>
      </td>
      <td className="px-2">
        <div className="flex items-center gap-1.5">
          <Avatar name={users.find((u) => u.id === t.assigneeId)?.name} />
          <select value={t.assigneeId ?? ""} onChange={(e) => onUpdate(t.id, { assigneeId: e.target.value || null })} className="w-full min-w-0 rounded-md bg-transparent py-1.5 outline-none hover:bg-white">
            <option value="">—</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </td>
      <td className="p-0.5">
        <ColorSelect value={t.status} options={TASK_STATUSES} onChange={(v) => onUpdate(t.id, { status: v })} />
      </td>
      <td className="px-2">
        <input
          type="date"
          value={t.dueDate ?? ""}
          onChange={(e) => onUpdate(t.id, { dueDate: e.target.value || null })}
          className={`w-full rounded-md bg-transparent px-1 py-1.5 outline-none hover:bg-white ${late ? "font-semibold text-brand-600" : ""}`}
          title={late ? "En retard" : undefined}
        />
      </td>
      <td className="p-0.5">
        <ColorSelect value={t.priority} options={TASK_PRIORITIES} onChange={(v) => onUpdate(t.id, { priority: v })} />
      </td>
      {showLinks && (
        <td className="px-2 text-xs">
          {t.dossierId ? (
            <Link href={`/prestations/${t.dossierId}`} className="block truncate text-link-600 hover:underline" title={t.dossierRef ?? ""}>{t.dossierRef}</Link>
          ) : t.clientId ? (
            <Link href={`/clients/${t.clientId}`} className="block truncate text-link-600 hover:underline">{t.clientName}</Link>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
      )}
    </tr>
  );
}

/** Cellule pleine couleur façon Monday. */
function ColorSelect({ value, options, onChange }: {
  value: string;
  options: readonly { id: string; label: string; cell: string }[];
  onChange: (v: string) => void;
}) {
  const cur = options.find((o) => o.id === value) ?? options[0];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full cursor-pointer appearance-none rounded-md py-2 text-center text-xs font-semibold text-white outline-none hover:brightness-95 ${cur.cell}`}
    >
      {options.map((o) => <option key={o.id} value={o.id} className="bg-white text-slate-800">{o.label}</option>)}
    </select>
  );
}

function Avatar({ name }: { name?: string }) {
  if (!name) return <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400">?</span>;
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">{initials}</span>;
}

/* ---------------- Vue Kanban ---------------- */

function Kanban({ rows, users, statuses, onUpdate, onOpen, onAdd }: {
  rows: TaskRow[]; users: Opt[]; statuses: readonly (typeof TASK_STATUSES)[number][];
  onUpdate: (id: string, p: Patch) => void; onOpen: (id: string) => void; onAdd: (p: Patch) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {statuses.map((s) => {
        const list = rows.filter((r) => r.status === s.id);
        return (
          <div
            key={s.id}
            className="min-w-40 flex-1 basis-0 rounded-xl bg-slate-100/70 p-2.5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              if (id) onUpdate(id, { status: s.id });
            }}
          >
            <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} /> {s.label}
              <span className="ml-auto text-xs font-normal text-slate-500">{list.length}</span>
            </div>
            <div className="min-h-20 space-y-2">
              {list.map((t) => {
                const p = taskPriority(t.priority);
                const late = isOverdue(t);
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    onClick={() => onOpen(t.id)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-link-500"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400">{taskType(t.type).icon}</span>
                      <span className={`font-medium ${t.status === "FAIT" ? "text-slate-400 line-through" : ""}`}>{t.title}</span>
                    </div>
                    {(t.dossierRef || t.clientName) && <div className="mt-1 truncate text-xs text-slate-500">{t.dossierRef ?? t.clientName}</div>}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <Avatar name={users.find((u) => u.id === t.assigneeId)?.name} />
                      <span className={late ? "font-semibold text-brand-600" : "text-slate-500"}>{t.dueDate ? fmt(t.dueDate) : ""}</span>
                      <span className={`rounded px-1.5 py-0.5 font-semibold text-white ${p.cell}`}>{p.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => onAdd({ title: "Nouvelle tâche", status: s.id })} className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-white">
              + Ajouter
            </button>
          </div>
        );
      })}
    </div>
  );
}

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/* ---------------- Panneau de détail ---------------- */

function Drawer({ task, users, clients, dossiers, lockLinks, onClose, onUpdate, onDelete }: {
  task: TaskRow; users: Opt[]; clients: Opt[]; dossiers: DossierOpt[]; lockLinks: boolean;
  onClose: () => void; onUpdate: (p: Patch) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description ?? "");
  useEffect(() => { setTitle(task.title); setDesc(task.description ?? ""); }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const st = taskStatus(task.status);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
        <div className={`h-1.5 ${st.cell}`} />
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <span className={`badge ${st.soft}`}>{st.label}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800" aria-label="Fermer">✕</button>
        </div>
        <div className="space-y-5 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== task.title && onUpdate({ title })}
            className="w-full rounded-md text-xl font-semibold outline-none focus:ring-2 focus:ring-link-100"
          />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Lbl label="Statut">
              <select value={task.status} onChange={(e) => onUpdate({ status: e.target.value })} className="input">
                {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Lbl>
            <Lbl label="Priorité">
              <select value={task.priority} onChange={(e) => onUpdate({ priority: e.target.value })} className="input">
                {TASK_PRIORITIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Lbl>
            <Lbl label="Type">
              <select value={task.type} onChange={(e) => onUpdate({ type: e.target.value })} className="input">
                {TASK_TYPES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
              </select>
            </Lbl>
            <Lbl label="Échéance">
              <input type="date" value={task.dueDate ?? ""} onChange={(e) => onUpdate({ dueDate: e.target.value || null })} className="input" />
            </Lbl>
            <Lbl label="Responsable">
              <select value={task.assigneeId ?? ""} onChange={(e) => onUpdate({ assigneeId: e.target.value || null })} className="input">
                <option value="">Non assignée</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Lbl>
          </div>

          {lockLinks ? (
            (task.dossierRef || task.clientName) && <p className="text-sm text-slate-500">Liée à : {task.dossierRef ?? task.clientName}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Lbl label="Client">
                <select value={task.clientId ?? ""} onChange={(e) => onUpdate({ clientId: e.target.value || null, dossierId: null })} className="input">
                  <option value="">Aucun</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Lbl>
              <Lbl label="Prestation">
                <select value={task.dossierId ?? ""} onChange={(e) => onUpdate({ dossierId: e.target.value || null })} className="input">
                  <option value="">Aucun</option>
                  {dossiers.filter((d) => !task.clientId || d.clientId === task.clientId).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </Lbl>
            </div>
          )}

          <Lbl label="Description / notes">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => desc !== (task.description ?? "") && onUpdate({ description: desc })}
              rows={8}
              placeholder="Détails, compte-rendu, points à vérifier…"
              className="input"
            />
          </Lbl>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
            {task.dossierId ? <Link href={`/prestations/${task.dossierId}`} className="text-link-600 hover:underline">Ouvrir le dossier →</Link> : <span />}
            <button onClick={() => confirm("Supprimer cette tâche ?") && onDelete()} className="text-slate-400 hover:text-brand-600">Supprimer</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Lbl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
