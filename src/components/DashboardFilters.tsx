"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DashboardFilters({ periods, period, members, member }: {
  periods: readonly { id: string; label: string }[];
  period: string;
  members: { id: string; name: string }[] | null;
  member: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    p.delete("acces");
    router.push(`${path}?${p}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={period} onChange={(e) => set("periode", e.target.value)} className="input w-48" aria-label="Période">
        {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {members && (
        <select value={member} onChange={(e) => set("membre", e.target.value)} className="input w-52" aria-label="Membre de l'équipe">
          <option value="">Toute l'équipe</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
    </div>
  );
}
