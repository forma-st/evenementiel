"use client";
import { useState } from "react";
import type { Field } from "@/lib/questionnaire";

/** Affiche un questionnaire. En mode `preview`, rien n'est soumis. */
export function FormRenderer({ fields, preview, errors = {}, defaults = {} }: {
  fields: Field[];
  preview?: boolean;
  errors?: Record<string, string>;
  defaults?: Record<string, unknown>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(defaults);
  const set = (id: string, v: unknown) => setValues((s) => ({ ...s, [id]: v }));

  return (
    <div className="space-y-5">
      <input type="hidden" name="answers" value={JSON.stringify(values)} />
      {fields.map((f) => {
        if (f.type === "section")
          return <h3 key={f.id} className="border-b border-slate-200 pt-3 pb-1 text-lg font-semibold">{f.label}{f.help && <span className="block text-sm font-normal text-slate-500">{f.help}</span>}</h3>;
        const v = values[f.id];
        const common = { id: f.id, className: "input", disabled: preview };
        return (
          <div key={f.id}>
            <label htmlFor={f.id} className="label">
              {f.label || <i className="text-slate-400">Question sans titre</i>} {f.required && <span className="text-rose-600">*</span>}
            </label>
            {f.help && <p className="-mt-0.5 mb-1.5 text-xs text-slate-500">{f.help}</p>}
            {f.type === "textarea" ? (
              <textarea {...common} rows={4} value={(v as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} />
            ) : f.type === "select" ? (
              <select {...common} value={(v as string) ?? ""} onChange={(e) => set(f.id, e.target.value)}>
                <option value="">Choisir…</option>
                {f.options?.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : f.type === "radio" || f.type === "yesno" ? (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {(f.type === "yesno" ? ["oui", "non"] : f.options ?? []).map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={`r-${f.id}`} disabled={preview} checked={v === o} onChange={() => set(f.id, o)} />
                    {f.type === "yesno" ? (o === "oui" ? "Oui" : "Non") : o}
                  </label>
                ))}
              </div>
            ) : f.type === "checkbox" ? (
              <div className="flex flex-col gap-2">
                {f.options?.map((o) => {
                  const arr = (v as string[]) ?? [];
                  return (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" disabled={preview} checked={arr.includes(o)} onChange={(e) => set(f.id, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />
                      {o}
                    </label>
                  );
                })}
              </div>
            ) : (
              <input
                {...common}
                type={f.type === "phone" ? "tel" : f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
                step={f.type === "number" ? "any" : undefined}
                value={(v as string) ?? ""}
                onChange={(e) => set(f.id, e.target.value)}
              />
            )}
            {errors[f.id] && <p className="mt-1 text-xs text-rose-600">{errors[f.id]}</p>}
          </div>
        );
      })}
    </div>
  );
}
