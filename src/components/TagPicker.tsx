"use client";
import { useEffect, useRef, useState } from "react";
import { quickCreateTag } from "@/app/(staff)/parametres/actions";
import { tagColor } from "@/lib/tags";

export type TagOpt = { id: string; name: string; color: string };

/** Liste déroulante à cases à cocher pour choisir des étiquettes existantes. */
export function TagPicker({ tags: initialTags, selected: initialSel, canCreate, name = "tagIds" }: {
  tags: TagOpt[];
  selected: string[];
  canCreate: boolean;
  name?: string;
}) {
  const [tags, setTags] = useState(initialTags);
  const [sel, setSel] = useState<string[]>(initialSel);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = tags.some((t) => t.name.toLowerCase() === q.trim().toLowerCase());

  const create = async () => {
    const r = await quickCreateTag(q);
    if ("error" in r) return setErr(r.error);
    setTags((t) => [...t.filter((x) => x.id !== r.id), r].sort((a, b) => a.name.localeCompare(b.name)));
    setSel((s) => (s.includes(r.id) ? s : [...s, r.id]));
    setQ("");
    setErr(null);
  };

  return (
    <div ref={box} className="relative">
      {sel.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex min-h-[40px] flex-wrap items-center gap-1.5 text-left"
        aria-haspopup="listbox"
      >
        {sel.length === 0 && <span className="text-slate-400">Choisir des étiquettes…</span>}
        {sel.map((id) => {
          const t = tags.find((x) => x.id === id);
          if (!t) return null;
          return (
            <span key={id} className={`badge gap-1 ring-1 ${tagColor(t.color).chip}`}>
              {t.name}
              <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); toggle(id); }} className="opacity-60 hover:opacity-100">✕</span>
            </span>
          );
        })}
        <span className="ml-auto text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered.length === 1) toggle(filtered[0].id);
                else if (canCreate && q.trim() && !exact) create();
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Rechercher une étiquette…"
            className="input mb-2 py-1.5"
          />
          <ul role="listbox" className="max-h-60 overflow-y-auto">
            {filtered.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={sel.includes(t.id)} onChange={() => toggle(t.id)} className="accent-brand-600" />
                  <span className={`h-2.5 w-2.5 rounded-full ${tagColor(t.color).dot}`} />
                  {t.name}
                </label>
              </li>
            ))}
            {filtered.length === 0 && !q && <li className="px-2 py-1.5 text-sm text-slate-500">Aucune étiquette. {canCreate ? "Tapez un nom pour en créer une." : "Demandez à un responsable d'en créer."}</li>}
          </ul>
          {canCreate && q.trim() && !exact && (
            <button type="button" onClick={create} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-link-600 hover:bg-slate-50">
              + Créer l'étiquette « {q.trim()} »
            </button>
          )}
          {err && <p className="px-2 text-xs text-brand-600">{err}</p>}
        </div>
      )}
    </div>
  );
}

export function TagChips({ tags }: { tags: TagOpt[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => <span key={t.id} className={`badge ring-1 ${tagColor(t.color).chip}`}>{t.name}</span>)}
    </div>
  );
}
