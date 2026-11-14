import Link from "next/link";
import { db } from "@/lib/db";
import { Kanban } from "@/components/Kanban";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { DOSSIER_STATUSES, OPEN_STATUSES, date, eur, statusOf, longDate, time, parisParts } from "@/lib/format";
import { eventKind, parseServices, serviceOf } from "@/lib/presta";
import { startOfDay } from "@/lib/tasks";
import { deleteDossier, setDossierStatus } from "../actions";
import { DeleteDossierButton } from "@/components/DeleteDossierButton";
import { DossierStatusSelect } from "@/components/DossierStatusSelect";
import { requireStaff } from "@/lib/auth";
import { dossierWhere, permsFor } from "@/lib/permissions";

export const metadata = { title: "Prestations" };

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default async function DossiersPage({ searchParams }: { searchParams: Promise<{ vue?: string; q?: string; status?: string; assignee?: string }> }) {
  const { vue, q = "", status = "", assignee = "" } = await searchParams;
  const view = vue === "liste" || status ? "liste" : vue === "kanban" ? "kanban" : "agenda";
  const me = await requireStaff();
  const perms = await permsFor(me);
  const [dossiers, users] = await Promise.all([
    db.dossier.findMany({
      where: {
        AND: [
          dossierWhere(me, perms),
          q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }, { venueName: { contains: q, mode: "insensitive" } }, { venueCity: { contains: q, mode: "insensitive" } }] } : {},
          view === "agenda" ? { status: { not: "PERDU" }, OR: [{ eventStart: { gte: startOfDay() } }, { eventStart: null, status: { in: OPEN_STATUSES } }] } : {},
          status ? { status } : {},
          assignee ? { assigneeId: assignee } : {},
        ],
      },
      include: { client: true, assignee: true, payments: { select: { amount: true, paidAt: true } }, _count: { select: { tasks: true, activities: true, quotes: true, events: true, signatures: true, assignments: true } } },
      orderBy: view === "agenda" ? [{ eventStart: { sort: "asc", nulls: "last" } }] : { updatedAt: "desc" },
    }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = (v: string) => `?${new URLSearchParams({ vue: v, q, assignee }).toString()}`;

  return (
    <div>
      <PageHeader
        title="Prestations"
        subtitle={`${dossiers.length} prestation(s)${view === "agenda" ? " à venir" : ""}`}
        actions={
          <>
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
              <Link href={qs("agenda")} className={`rounded-md px-3 py-1.5 ${view === "agenda" ? "bg-slate-100 font-medium" : ""}`}>À venir</Link>
              <Link href={qs("kanban")} className={`rounded-md px-3 py-1.5 ${view === "kanban" ? "bg-slate-100 font-medium" : ""}`}>Pipeline</Link>
              <Link href={qs("liste")} className={`rounded-md px-3 py-1.5 ${view === "liste" ? "bg-slate-100 font-medium" : ""}`}>Liste</Link>
            </div>
            <Link href="/prestations/nouveau" className="btn-primary">+ Nouvelle prestation</Link>
          </>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="vue" value={view} />
        <input name="q" defaultValue={q} placeholder="Rechercher…" className="input max-w-xs" />
        {view === "liste" && (
          <select name="status" defaultValue={status} className="input max-w-48">
            <option value="">Tous statuts</option>
            {DOSSIER_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
        <select name="assignee" defaultValue={assignee} className="input max-w-48">
          <option value="">Tous collaborateurs</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      {view === "agenda" ? (
        dossiers.length === 0 ? <div className="card"><Empty>Aucune prestation à venir.</Empty></div> : (
          <div className="space-y-6">
            {[...new Set(dossiers.map((d) => (d.eventStart ? `${parisParts(d.eventStart).y}-${String(parisParts(d.eventStart).m).padStart(2, "0")}` : "sans-date")))].map((m) => {
              const list = dossiers.filter((d) => (d.eventStart ? `${parisParts(d.eventStart).y}-${String(parisParts(d.eventStart).m).padStart(2, "0")}` : "sans-date") === m);
              const title = m === "sans-date" ? "Demandes sans date" : `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
              return (
                <section key={m}>
                  <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title} <span className="font-normal">({list.length})</span></h2>
                  <div className="card divide-y divide-slate-100">
                    {list.map((d) => {
                      const st = statusOf(d.status);
                      const paid = d.payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
                      const due = d.payments.reduce((a, p) => a + p.amount, 0);
                      return (
                        <Link key={d.id} href={`/prestations/${d.id}`} className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-slate-50">
                          <div className="w-14 shrink-0 text-center">
                            {d.eventStart ? <><div className="text-2xl leading-none font-semibold">{parisParts(d.eventStart).d}</div><div className="text-[11px] text-slate-500 uppercase">{longDate(d.eventStart).split(" ")[0].slice(0, 3)}</div></> : <div className="text-slate-300">—</div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{eventKind(d.eventType).icon} {d.title}</div>
                            <div className="text-xs text-slate-500">{d.client.name}{d.venueName || d.venueCity ? ` · ${[d.venueName, d.venueCity].filter(Boolean).join(", ")}` : ""}{d.eventStart ? ` · ${time(d.eventStart)}` : ""}{d.guests ? ` · ${d.guests} invités` : ""}</div>
                          </div>
                          <div className="flex flex-wrap gap-1">{parseServices(d.services).map((x) => <span key={x} title={serviceOf(x)?.label} className={`badge ${serviceOf(x)?.color ?? "bg-slate-100"}`}>{serviceOf(x)?.icon ?? x}</span>)}</div>
                          <div className="w-28 text-right text-xs text-slate-500">{d.assignee?.name ?? "non assigné"}</div>
                          <div className="w-32 text-right text-xs">{due > 0 ? <span className={paid >= due ? "text-emerald-700" : "text-slate-600"}>{eur(paid)} / {eur(due)}</span> : <span className="text-slate-400">{eur(d.amount)}</span>}</div>
                          <Badge className={st.color}>{st.label}</Badge>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : view === "kanban" ? (
        <Kanban
          onMove={setDossierStatus}
          dossiers={dossiers.map((d) => ({
            id: d.id, reference: d.reference, title: d.title, status: d.status, priority: d.priority,
            client: d.client.name, assignee: d.assignee?.name ?? null, due: d.eventStart ? date(d.eventStart) : null,
          }))}
        />
      ) : (
        <div className="card overflow-x-auto">
          {dossiers.length === 0 ? <Empty>Aucune prestation.</Empty> : (
            <table className="table">
              <thead><tr><th>Réf.</th><th>Date</th><th>Prestation</th><th>Client</th><th>Lieu</th><th>Responsable</th><th>Montant</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {dossiers.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="text-slate-500">{d.reference}</td>
                    <td className="whitespace-nowrap">{date(d.eventStart)}</td>
                    <td><Link href={`/prestations/${d.id}`} className="font-medium text-link-600 hover:underline">{d.title}</Link></td>
                    <td>{d.client.name}</td>
                    <td className="text-slate-500">{d.venueCity ?? d.venueName ?? "—"}</td>
                    <td>{d.assignee?.name ?? "—"}</td>
                    <td>{eur(d.amount)}</td>
                    <td><DossierStatusSelect id={d.id} status={d.status} onChange={setDossierStatus} /></td>
                    <td className="text-right">
                      {perms.canDeleteDossiers && <DeleteDossierButton compact action={deleteDossier.bind(null, d.id, "/prestations?vue=liste")} title={d.title} counts={d._count} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
