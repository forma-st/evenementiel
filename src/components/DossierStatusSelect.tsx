"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DOSSIER_STATUSES } from "@/lib/format";

/** Statut modifiable directement dans la liste (déclenche les automatisations). */
export function DossierStatusSelect({ id, status, onChange }: { id: string; status: string; onChange: (id: string, status: string) => Promise<void> }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const cur = DOSSIER_STATUSES.find((s) => s.id === value) ?? DOSSIER_STATUSES[0];
  return (
    <div>
      <select
        value={value}
        disabled={pending}
        aria-label="Statut du dossier"
        onChange={(e) => {
          const next = e.target.value, prev = value;
          setValue(next);
          setError(false);
          start(async () => {
            try {
              await onChange(id, next);
              router.refresh();
            } catch {
              setValue(prev);
              setError(true);
            }
          });
        }}
        className={`cursor-pointer appearance-none rounded-full border-0 px-2.5 py-1 pr-6 text-xs font-medium outline-none focus:ring-2 focus:ring-link-100 ${cur.color} ${pending ? "opacity-60" : ""}`}
        style={{ backgroundImage: "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)", backgroundPosition: "calc(100% - 11px) 55%, calc(100% - 7px) 55%", backgroundSize: "4px 4px", backgroundRepeat: "no-repeat" }}
      >
        {DOSSIER_STATUSES.map((s) => <option key={s.id} value={s.id} className="bg-white text-slate-800">{s.label}</option>)}
      </select>
      {error && <div className="mt-0.5 text-[11px] text-brand-600">Modification refusée</div>}
    </div>
  );
}
