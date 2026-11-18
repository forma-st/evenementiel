import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { clientWhere, permsFor } from "@/lib/permissions";
import { PERIODS, dashboardStats, teamTable, type PeriodId } from "@/lib/stats";
import { date, time } from "@/lib/format";
import { addDays, isOverdue, startOfDay, taskPriority, taskType } from "@/lib/tasks";
import { eventType } from "@/lib/events";
import { eventKind } from "@/lib/presta";
import { SIGNATURE_STATUSES } from "@/lib/signature";
import { WIDGETS, WIDGET_IDS, allowed, readLayout, type WidgetId } from "@/lib/widgets";
import { conversationsFor } from "@/lib/chat";
import { getCompany } from "@/lib/company";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { DashboardFilters } from "@/components/DashboardFilters";
import { DashboardGrid } from "@/components/DashboardGrid";
import { PipelineChart, RevenueChart, TasksChart } from "@/components/ChartBlocks";

export const metadata = { title: "Tableau de bord" };

const eur0 = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-slate-400">—</span>;
  const up = value >= 0;
  return <span className={`text-xs font-medium ${up ? "text-emerald-700" : "text-brand-700"}`}>{up ? "▲" : "▼"} {Math.abs(value)} % vs période préc.</span>;
}
const More = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} className="text-sm text-link-600 hover:underline">{children}</Link>;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ periode?: string; membre?: string; acces?: string }> }) {
  const user = await requireStaff();
  const [perms, sp, company] = await Promise.all([permsFor(user), searchParams, getCompany()]);
  const period = (PERIODS.some((p) => p.id === sp.periode) ? sp.periode : "12m") as PeriodId;
  const team = perms.canViewTeamDashboard;
  const memberId = team ? sp.membre || null : user.id;
  const teamChat = company.teamChat;
  const layout = readLayout(user.dashboardLayout, perms).filter((l) => teamChat || l.id !== "messages");
  const on = new Set(layout.map((l) => l.id));
  const needStats = ["kpis", "revenue", "pipeline", "tasksChart"].some((w) => on.has(w as WidgetId));

  const [stats, members, myTasks, myEvents, recent, rows, signatures, answers, convs, upcoming, pays] = await Promise.all([
    needStats ? dashboardStats(memberId, period) : null,
    team ? db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : null,
    on.has("myTasks") ? db.task.findMany({ where: { assigneeId: user.id, status: { not: "FAIT" }, dueDate: { lt: addDays(startOfDay(), 8) } }, include: { client: true, dossier: true }, orderBy: { dueDate: "asc" }, take: 8 }) : [],
    on.has("events") ? db.event.findMany({ where: { attendees: { some: { userId: user.id } }, end: { gte: new Date() }, start: { lt: addDays(new Date(), 14) } }, include: { client: { select: { name: true } } }, orderBy: { start: "asc" }, take: 6 }) : [],
    on.has("activity") ? db.activity.findMany({ where: memberId ? { OR: [{ userId: memberId }, { dossier: { assigneeId: memberId } }] } : {}, include: { dossier: true, user: true }, orderBy: { createdAt: "desc" }, take: 6 }) : [],
    on.has("team") && team && !memberId ? teamTable(period) : null,
    on.has("signatures") ? db.signatureRequest.findMany({ where: { status: "EN_ATTENTE", client: clientWhere(user, perms), ...(memberId ? { createdById: memberId } : {}) }, select: { id: true, title: true, status: true, createdAt: true, expiresAt: true, client: { select: { name: true } }, signers: { select: { status: true, viewedAt: true } } }, orderBy: { createdAt: "desc" }, take: 6 }) : [],
    on.has("questionnaires") ? db.questionnaireAssignment.findMany({ where: { status: "COMPLETE", client: clientWhere(user, perms) }, include: { questionnaire: { select: { title: true } }, client: { select: { name: true } } }, orderBy: { submittedAt: "desc" }, take: 6 }) : [],
    on.has("messages") ? conversationsFor(user.id) : [],
    on.has("upcoming") ? db.dossier.findMany({ where: { status: { in: ["OPTION", "CONFIRME"] }, eventStart: { gte: startOfDay(), lt: addDays(new Date(), 60) }, ...(memberId ? { assigneeId: memberId } : {}) }, include: { client: { select: { name: true } }, assignee: { select: { name: true } } }, orderBy: { eventStart: "asc" }, take: 8 }) : [],
    on.has("payments") ? db.payment.findMany({ where: { paidAt: null, dueDate: { lt: addDays(new Date(), 30) }, dossier: { status: { not: "PERDU" } } }, include: { dossier: { select: { id: true, title: true, client: { select: { name: true } } } } }, orderBy: { dueDate: "asc" }, take: 8 }) : [],
  ]);
  const lastMessages = on.has("messages")
    ? await Promise.all(convs.slice(0, 5).map(async (c) => ({ c, m: await db.message.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } }) })))
    : [];
  const who = memberId ? (memberId === user.id ? "vos chiffres" : `chiffres de ${members?.find((m) => m.id === memberId)?.name ?? "ce membre"}`) : "chiffres de toute l'équipe";

  const contents: Partial<Record<WidgetId, { body: React.ReactNode; action?: React.ReactNode }>> = {};

  if (stats && on.has("kpis")) {
    const k = stats.kpi;
    const tiles = [
      { label: "CA signé (HT)", value: eur0(k.acceptedHT), sub: <Delta value={pct(k.acceptedHT, k.prevAcceptedHT)} />, href: "/devis?status=ACCEPTE" },
      { label: "Devis émis (HT)", value: eur0(k.sentHT), sub: <span className="text-xs text-slate-500">{k.sentCount} devis</span>, href: "/devis" },
      { label: "Taux de transformation", value: k.conversion === null ? "—" : `${Math.round(k.conversion * 100)} %`, sub: <span className="text-xs text-slate-500">{k.acceptedCount} accepté(s) / {k.sentCount}</span> },
      { label: "Nouveaux clients", value: String(k.newClients), sub: <Delta value={pct(k.newClients, k.prevNewClients)} />, href: "/clients" },
      { label: "Tâches terminées", value: String(k.doneTasks), sub: <span className={`text-xs ${k.lateTasks ? "font-medium text-brand-700" : "text-slate-500"}`}>{k.lateTasks} en retard</span>, href: "/taches" },
      { label: "RDV à 7 jours", value: String(k.upcomingEvents), sub: <span className="text-xs text-slate-500">prestations, rendez-vous…</span>, href: "/agenda?vue=liste" },
    ];
    contents.kpis = {
      body: (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          {tiles.map((t) => {
            const inner = (<><div className="text-xs text-slate-500">{t.label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</div><div className="mt-1">{t.sub}</div></>);
            return t.href
              ? <Link key={t.label} href={t.href} className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 hover:border-link-500">{inner}</Link>
              : <div key={t.label} className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">{inner}</div>;
          })}
        </div>
      ),
    };
  }
  if (on.has("upcoming")) {
    contents.upcoming = {
      action: <More href="/prestations">Toutes →</More>,
      body: upcoming.length === 0 ? <Empty>Aucune prestation dans les 60 prochains jours.</Empty> : (
        <ul className="divide-y divide-slate-100">
          {upcoming.map((d) => {
            const days = Math.ceil((d.eventStart!.getTime() - Date.now()) / 864e5);
            return (
              <li key={d.id}>
                <Link href={`/prestations/${d.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-brand-700">
                  <span className={`w-14 shrink-0 rounded-md py-1 text-center text-xs font-semibold ${days <= 7 ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>J-{days}</span>
                  <div className="w-24 shrink-0 text-xs text-slate-500">{date(d.eventStart)}<br />{time(d.eventStart!)}</div>
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{eventKind(d.eventType).icon} {d.title}</div><div className="truncate text-xs text-slate-500">{[d.venueName, d.venueCity].filter(Boolean).join(", ") || d.client.name}</div></div>
                  <span className="hidden text-xs text-slate-500 sm:block">{d.assignee?.name ?? "non assigné"}</span>
                  {d.status === "OPTION" && <span className="badge bg-amber-100 text-amber-800">option</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      ),
    };
  }
  if (on.has("payments")) {
    const late = pays.filter((p) => p.dueDate! < new Date());
    contents.payments = {
      body: pays.length === 0 ? <Empty>Aucune échéance dans les 30 jours.</Empty> : (
        <div>
          {late.length > 0 && <p className="mb-2 text-sm font-medium text-rose-600">{late.length} en retard : {eur0(late.reduce((a, p) => a + p.amount, 0))}</p>}
          <ul className="divide-y divide-slate-100 text-sm">
            {pays.map((p) => (
              <li key={p.id}><Link href={p.dossier ? `/prestations/${p.dossier.id}` : "/comptabilite"} className="flex items-center justify-between gap-2 py-2 hover:text-brand-700"><span className="min-w-0"><span className="block truncate">{p.dossier?.client.name}</span><span className={`text-xs ${p.dueDate! < new Date() ? "text-rose-600" : "text-slate-500"}`}>{p.label} · {date(p.dueDate)}</span></span><span className="font-medium tabular-nums">{eur0(p.amount)}</span></Link></li>
            ))}
          </ul>
        </div>
      ),
    };
  }
  if (stats && on.has("revenue")) contents.revenue = { body: <RevenueChart months={stats.months} />, action: <More href="/devis">Devis →</More> };
  if (stats && on.has("pipeline")) contents.pipeline = { body: <PipelineChart rows={stats.pipeline} />, action: <More href="/prestations?vue=kanban">Pipeline →</More> };
  if (stats && on.has("tasksChart")) contents.tasksChart = { body: <TasksChart weeks={stats.weeks} /> };

  if (on.has("team")) {
    contents.team = {
      action: <span className="text-xs text-slate-500">Cliquez sur un nom pour filtrer</span>,
      body: !rows ? (
        <p className="text-sm text-slate-500">Affichez « Toute l'équipe » pour comparer les membres.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Membre</th><th className="text-right">CA signé HT</th><th className="text-right">Prestations en cours</th><th className="text-right">Tâches terminées</th><th className="text-right">En retard</th><th className="text-right">Événements</th></tr></thead>
            <tbody>
              {rows.sort((a, b) => b.acceptedHT - a.acceptedHT).map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/?periode=${period}&membre=${r.id}`} className="font-medium text-link-600 hover:underline">{r.name}</Link>{r.jobTitle && <div className="text-xs text-slate-500">{r.jobTitle}</div>}</td>
                  <td className="text-right tabular-nums">{eur0(r.acceptedHT)}</td>
                  <td className="text-right tabular-nums">{r.openDossiers}</td>
                  <td className="text-right tabular-nums">{r.done}</td>
                  <td className={`text-right tabular-nums ${r.late ? "font-semibold text-brand-700" : ""}`}>{r.late}</td>
                  <td className="text-right tabular-nums">{r.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    };
  }

  if (on.has("events")) {
    contents.events = {
      action: <More href="/agenda/nouveau">+ Planifier</More>,
      body: myEvents.length === 0 ? <Empty>Rien de prévu dans les 14 prochains jours.</Empty> : (
        <ul className="divide-y divide-slate-100">
          {myEvents.map((e) => {
            const t = eventType(e.type);
            return (
              <li key={e.id}>
                <Link href={`/agenda/${e.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-brand-700">
                  <span className={`h-8 w-1 rounded ${t.dot}`} />
                  <div className="w-24 shrink-0 text-xs text-slate-500">{date(e.start)}{!e.allDay && <><br />{time(e.start)}</>}</div>
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{t.icon} {e.title}</div>{e.client && <div className="truncate text-xs text-slate-500">{e.client.name}</div>}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      ),
    };
  }

  if (on.has("myTasks")) {
    contents.myTasks = {
      action: <More href="/taches">Toutes mes tâches →</More>,
      body: myTasks.length === 0 ? <Empty>Rien d'urgent.</Empty> : (
        <ul className="divide-y divide-slate-100">
          {myTasks.map((t) => {
            const late = isOverdue(t);
            const pr = taskPriority(t.priority);
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-5 text-center text-slate-400">{taskType(t.type).icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.title}</div>
                  {(t.dossier || t.client) && (
                    <Link href={t.dossier ? `/prestations/${t.dossier.id}` : `/clients/${t.clientId}`} className="text-xs text-link-600 hover:underline">
                      {t.dossier ? `${t.dossier.reference} · ${t.dossier.title}` : t.client?.name}
                    </Link>
                  )}
                </div>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold text-white ${pr.cell}`}>{pr.label}</span>
                <span className={`w-24 text-right text-xs ${late ? "font-semibold text-brand-600" : "text-slate-500"}`}>{late ? "En retard · " : ""}{date(t.dueDate)}</span>
              </li>
            );
          })}
        </ul>
      ),
    };
  }

  if (on.has("activity")) {
    contents.activity = {
      body: recent.length === 0 ? <Empty>Rien pour l'instant.</Empty> : (
        <ul className="space-y-3 text-sm">
          {recent.map((a) => (
            <li key={a.id}>
              <Link href={`/prestations/${a.dossierId}`} className="hover:text-brand-700"><span className="font-medium">{a.dossier.reference}</span> — {a.body.split("\n")[0].slice(0, 100)}</Link>
              <div className="text-xs text-slate-500">{a.user?.name ?? "Client"} · {date(a.createdAt)}</div>
            </li>
          ))}
        </ul>
      ),
    };
  }

  if (on.has("signatures")) {
    contents.signatures = {
      action: <More href="/signatures?statut=EN_ATTENTE">Toutes →</More>,
      body: signatures.length === 0 ? <Empty>Aucune signature en attente.</Empty> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {signatures.map((s) => {
            const done = s.signers.filter((x) => x.status === "SIGNE").length;
            const viewed = s.signers.some((x) => x.viewedAt);
            return (
              <li key={s.id}>
                <Link href={`/signatures/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-700">
                  <span className="min-w-0"><span className="block truncate font-medium">{s.title}</span><span className="text-xs text-slate-500">{s.client.name} · envoyé le {date(s.createdAt)}</span></span>
                  <span className="shrink-0 text-right text-xs text-slate-500">{done}/{s.signers.length} signé(s)<br />{viewed ? "document ouvert" : "pas encore ouvert"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ),
    };
  }

  if (on.has("questionnaires")) {
    contents.questionnaires = {
      action: <More href="/questionnaires">Questionnaires →</More>,
      body: answers.length === 0 ? <Empty>Aucune réponse reçue pour l'instant.</Empty> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {answers.map((a) => (
            <li key={a.id}>
              <Link href={`/questionnaires/reponse/${a.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-700">
                <span className="min-w-0"><span className="block truncate font-medium">{a.client.name}</span><span className="text-xs text-slate-500">{a.questionnaire.title}</span></span>
                <Badge className="bg-emerald-100 text-emerald-700">{date(a.submittedAt)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ),
    };
  }

  if (on.has("messages")) {
    contents.messages = {
      action: <More href="/messages">Messagerie →</More>,
      body: lastMessages.length === 0 ? <Empty>Aucune conversation.</Empty> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {lastMessages.map(({ c, m }) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-start justify-between gap-3 py-2.5 hover:text-brand-700">
                <span className="min-w-0">
                  <span className={`block truncate ${c.unread ? "font-semibold" : "font-medium"}`}>{c.name}</span>
                  <span className="block truncate text-xs text-slate-500">{m ? `${m.user?.name.split(" ")[0] ?? "?"} : ${m.body}` : "Aucun message"}</span>
                </span>
                {c.unread > 0 && <span className="shrink-0 rounded-full bg-link-600 px-1.5 text-[10px] font-semibold text-white">{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ),
    };
  }

  const catalog = WIDGET_IDS.filter((id) => allowed(id, perms) && (teamChat || id !== "messages")).map((id) => ({ id, title: WIDGETS[id].title, help: WIDGETS[id].help, size: WIDGETS[id].size }));

  return (
    <div className="space-y-6">
      {sp.acces === "refuse" && <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Vous n'avez pas accès à cette page. Demandez à un administrateur de modifier vos droits.</div>}
      <PageHeader
        title={`Bonjour ${user.name.split(" ")[0]}`}
        subtitle={`Tableau de bord — ${who}`}
        actions={<DashboardFilters periods={PERIODS} period={period} members={members} member={memberId && team ? memberId : ""} />}
      />
      <DashboardGrid initial={layout} catalog={catalog} contents={contents} />
    </div>
  );
}
