"use client";
import { useState, useTransition } from "react";
import { FIELD_TYPES, hasOptions, type Field, type FieldType } from "@/lib/questionnaire";
import { FormRenderer } from "./FormRenderer";

const uid = () => Math.random().toString(36).slice(2, 10);

export function QuestionnaireBuilder({ initial, onSave }: {
  initial: { title: string; description: string; fields: Field[] };
  onSave: (d: { title: string; description: string; fields: Field[] }) => Promise<{ ok: boolean }>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [fields, setFields] = useState<Field[]>(initial.fields);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (i: number, p: Partial<Field>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, dir: -1 | 1) =>
    setFields((fs) => {
      const j = i + dir;
      if (j < 0 || j >= fs.length) return fs;
      const c = [...fs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const add = (type: FieldType) =>
    setFields((fs) => [...fs, { id: uid(), type, label: "", required: false, options: hasOptions(type) ? ["Option 1", "Option 2"] : undefined }]);
  const save = () =>
    start(async () => {
      await onSave({ title, description, fields });
      setSaved(new Date().toLocaleTimeString("fr-FR"));
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={pending} className="btn-primary">{pending ? "Enregistrement…" : "Enregistrer"}</button>
        <button onClick={() => setPreview((p) => !p)} className="btn-secondary">{preview ? "← Éditer" : "Aperçu"}</button>
        {saved && <span className="text-sm text-emerald-700">Enregistré à {saved}</span>}
      </div>

      {preview ? (
        <div className="card mx-auto max-w-2xl p-6">
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && <p className="mt-1 mb-4 text-sm text-slate-600 whitespace-pre-wrap">{description}</p>}
          <FormRenderer fields={fields} preview />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div className="card space-y-3 p-5">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du questionnaire" className="input text-lg font-semibold" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Introduction affichée au client (facultatif)" className="input" />
            </div>

            {fields.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">Ajoutez des questions avec les boutons à droite.</div>}

            {fields.map((f, i) => (
              <div key={f.id} className={`card p-5 ${f.type === "section" ? "border-l-4 border-l-brand-500" : ""}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <select value={f.type} onChange={(e) => {
                    const type = e.target.value as FieldType;
                    update(i, { type, options: hasOptions(type) ? f.options ?? ["Option 1"] : undefined });
                  }} className="input w-auto">
                    {FIELD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  {f.type !== "section" && (
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} /> Obligatoire
                    </label>
                  )}
                  <div className="ml-auto flex gap-1 text-slate-400">
                    <button onClick={() => move(i, -1)} className="px-2 hover:text-slate-800" title="Monter">↑</button>
                    <button onClick={() => move(i, 1)} className="px-2 hover:text-slate-800" title="Descendre">↓</button>
                    <button onClick={() => setFields((fs) => [...fs.slice(0, i + 1), { ...f, id: uid() }, ...fs.slice(i + 1)])} className="px-2 hover:text-slate-800" title="Dupliquer">⧉</button>
                    <button onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="px-2 hover:text-rose-600" title="Supprimer">✕</button>
                  </div>
                </div>
                <input value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder={f.type === "section" ? "Titre de la section" : "Intitulé de la question"} className="input font-medium" />
                <input value={f.help ?? ""} onChange={(e) => update(i, { help: e.target.value })} placeholder="Aide / précision (facultatif)" className="input mt-2 text-slate-600" />
                {hasOptions(f.type) && (
                  <div className="mt-3 space-y-2">
                    {(f.options ?? []).map((o, k) => (
                      <div key={k} className="flex gap-2">
                        <input value={o} onChange={(e) => update(i, { options: f.options!.map((x, m) => (m === k ? e.target.value : x)) })} className="input" />
                        <button onClick={() => update(i, { options: f.options!.filter((_, m) => m !== k) })} className="px-2 text-slate-400 hover:text-rose-600">✕</button>
                      </div>
                    ))}
                    <button onClick={() => update(i, { options: [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`] })} className="text-sm text-link-600">+ Ajouter une option</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="card h-fit p-4 lg:sticky lg:top-8">
            <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Ajouter</div>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {FIELD_TYPES.map((t) => (
                <button key={t.id} onClick={() => add(t.id)} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100">+ {t.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
