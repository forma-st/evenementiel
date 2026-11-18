/** Affiché instantanément au changement de page, pendant le chargement des données. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="space-y-2"><div className="h-7 w-64 rounded-lg bg-slate-200" /><div className="h-4 w-96 max-w-full rounded bg-slate-100" /></div>
      <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 rounded-xl bg-slate-100 lg:col-span-2" />
        <div className="h-72 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
