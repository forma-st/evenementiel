"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDashboardLayout } from "@/app/(staff)/dashboardActions";
import { SIZE_LABEL, SPAN, type LayoutItem, type WidgetId, type WidgetSize } from "@/lib/widgets";

type Catalog = { id: WidgetId; title: string; help: string; size: WidgetSize }[];

export function DashboardGrid({ initial, catalog, contents }: {
  initial: LayoutItem[];
  catalog: Catalog;
  contents: Partial<Record<WidgetId, { body: React.ReactNode; action?: React.ReactNode; bare?: boolean }>>;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [overId, setOverId] = useState<WidgetId | null>(null);
  const [saving, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (next: LayoutItem[] | null, refresh = false) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => start(async () => {
      await saveDashboardLayout(next);
      setSavedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      if (refresh) router.refresh();
    }), refresh ? 0 : 400);
  };
  const update = (next: LayoutItem[], refresh = false) => { setLayout(next); persist(next, refresh); };

  const move = (id: WidgetId, dir: -1 | 1) => {
    const i = layout.findIndex((x) => x.id === id), j = i + dir;
    if (j < 0 || j >= layout.length) return;
    const n = [...layout]; [n[i], n[j]] = [n[j], n[i]]; update(n);
  };
  const dropOn = (target: WidgetId) => {
    if (!dragId || dragId === target) return;
    const n = layout.filter((x) => x.id !== dragId);
    const idx = n.findIndex((x) => x.id === target);
    n.splice(idx, 0, layout.find((x) => x.id === dragId)!);
    update(n);
  };
  const hidden = catalog.filter((c) => !layout.some((l) => l.id === c.id));
  const title = (id: WidgetId) => catalog.find((c) => c.id === id)?.title ?? id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {editing && <span className="text-xs text-slate-500">{saving ? "Enregistrement…" : savedAt ? `Disposition enregistrée à ${savedAt}` : "Glissez les blocs pour les réorganiser"}</span>}
        {editing && (
          <button onClick={() => { if (confirm("Revenir à la disposition par défaut ?")) { persist(null, true); setEditing(false); } }} className="text-xs text-slate-500 underline hover:text-slate-800">
            Réinitialiser
          </button>
        )}
        <button onClick={() => setEditing((e) => !e)} className={editing ? "btn-primary" : "btn-secondary"}>
          {editing ? "✓ Terminer" : "⚙ Personnaliser"}
        </button>
      </div>

      {editing && hidden.length > 0 && (
        <div className="rounded-xl border border-dashed border-link-500 bg-link-100/20 p-4">
          <div className="mb-2 text-sm font-semibold">Ajouter un widget</div>
          <div className="flex flex-wrap gap-2">
            {hidden.map((c) => (
              <button key={c.id} onClick={() => update([...layout, { id: c.id, size: c.size }], true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-link-500" title={c.help}>
                <span className="font-medium">+ {c.title}</span>
                <span className="block text-xs text-slate-500">{c.help}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-flow-row-dense grid-cols-1 gap-6 md:grid-cols-12">
        {layout.map((w) => {
          const c = contents[w.id];
          if (c?.bare && !editing) return <div key={w.id} className={`min-w-0 ${SPAN[w.size]}`}>{c.body}</div>;
          return (
            <section
              key={w.id}
              draggable={editing}
              onDragStart={(e) => { setDragId(w.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", w.id); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => { if (editing) { e.preventDefault(); setOverId(w.id); } }}
              onDrop={(e) => { e.preventDefault(); dropOn(w.id); setOverId(null); }}
              className={`card min-w-0 ${SPAN[w.size]} ${editing ? "cursor-grab border-dashed border-slate-300" : ""} ${dragId === w.id ? "opacity-40" : ""} ${overId === w.id && dragId !== w.id ? "ring-2 ring-link-500" : ""}`}
              aria-label={title(w.id)}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
                <h2 className="flex min-w-0 items-center gap-2 font-semibold">
                  {editing && <span className="text-slate-400" aria-hidden>⋮⋮</span>}
                  <span className="truncate" title={title(w.id)}>{title(w.id)}</span>
                </h2>
                {editing ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => move(w.id, -1)} className="rounded px-1.5 text-slate-500 hover:bg-slate-100" aria-label="Déplacer avant">←</button>
                    <button onClick={() => move(w.id, 1)} className="rounded px-1.5 text-slate-500 hover:bg-slate-100" aria-label="Déplacer après">→</button>
                    <select
                      value={w.size}
                      onChange={(e) => update(layout.map((x) => (x.id === w.id ? { ...x, size: e.target.value as WidgetSize } : x)))}
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                      aria-label="Largeur"
                    >
                      {(Object.keys(SIZE_LABEL) as WidgetSize[]).map((s) => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}
                    </select>
                    <button onClick={() => update(layout.filter((x) => x.id !== w.id))} className="rounded px-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600" aria-label="Masquer ce widget" title="Masquer">✕</button>
                  </div>
                ) : (
                  c?.action
                )}
              </div>
              <div className={`p-5 ${editing ? "pointer-events-none select-none" : ""}`}>
                {c ? c.body : <p className="py-6 text-center text-sm text-slate-400">Chargement…</p>}
              </div>
            </section>
          );
        })}
      </div>
      {layout.length === 0 && <div className="card p-10 text-center text-sm text-slate-500">Votre tableau de bord est vide. Cliquez sur « Personnaliser » pour ajouter des widgets.</div>}
    </div>
  );
}
