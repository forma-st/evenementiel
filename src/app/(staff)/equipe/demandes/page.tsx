import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { baseUrl } from "@/lib/merge";
import { parisParts } from "@/lib/format";
import { HelperBook, TeamRequestCard, TeamRequestForm, type HelperView, type ReqView } from "@/components/TeamRequests";
import { Fold } from "@/components/Fold";

export const metadata = { title: "Demandes de l'équipe" };

export default async function TeamRequests({ searchParams }: { searchParams: Promise<{ renfort?: string; voir?: string }> }) {
  const u = await requireStaff();
  const sp = await searchParams;
  const all = sp.voir === "tout";
  const [rows, users, helpersRaw] = await Promise.all([
    db.teamRequest.findMany({ where: all ? {} : { OR: [{ status: { in: ["OUVERTE", "ATTRIBUEE"] } }, { updatedAt: { gte: new Date(Date.now() - 14 * 864e5) } }] }, include: { replies: { orderBy: { createdAt: "asc" } }, invites: { include: { helper: true }, orderBy: { createdAt: "asc" } } }, orderBy: [{ createdAt: "desc" }], take: 100 }),
    db.user.findMany({ where: { role: { not: "CLIENT" } }, select: { id: true, name: true } }),
    db.helper.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
  ]);
  const helpers: HelperView[] = helpersRaw.map((h) => ({ id: h.id, name: h.name, phone: h.phone, email: h.email, skills: h.skills, notes: h.notes, active: h.active }));
  const name = (id: string | null) => users.find((x) => x.id === id)?.name ?? "—";
  const refs = await db.dossier.findMany({ where: { id: { in: rows.map((r) => r.dossierId).filter((x): x is string => !!x) } }, select: { id: true, reference: true } });
  let prefill;
  if (sp.renfort) {
    const d = await db.dossier.findUnique({ where: { id: sp.renfort }, select: { id: true, title: true, eventStart: true, setupTime: true, venueName: true, venueCity: true } });
    if (d) prefill = { kind: "RENFORT", title: `Renfort install : ${d.title}`, dossierId: d.id, date: d.eventStart ? parisParts(d.eventStart).key : undefined, startTime: d.setupTime ?? undefined, venue: d.venueName ?? undefined, city: d.venueCity ?? undefined };
  }
  const order = { OUVERTE: 0, ATTRIBUEE: 1, CONVERTIE: 2, ANNULEE: 3 } as Record<string, number>;
  const view: ReqView[] = rows.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).map((r) => ({
    id: r.id, kind: r.kind, title: r.title, eventType: r.eventType, date: r.date, startTime: r.startTime, endTime: r.endTime, venue: r.venue, city: r.city,
    clientName: r.clientName, clientPhone: r.clientPhone, clientEmail: r.clientEmail, guests: r.guests, services: r.services, budget: r.budget, notes: r.notes,
    status: r.status, author: name(r.createdById), authorId: r.createdById, assignee: r.assigneeId ? name(r.assigneeId) : null, dossierId: r.dossierId,
    dossierRef: refs.find((x) => x.id === r.dossierId)?.reference ?? null, createdAt: r.createdAt.toISOString(),
    replies: r.replies.map((x) => ({ userId: x.userId, name: name(x.userId), answer: x.answer, comment: x.comment })),
    invites: r.invites.map((i) => ({ helperId: i.helperId, name: i.helper.name, phone: i.helper.phone, email: i.helper.email, answer: i.answer, comment: i.comment, token: i.token, viewed: !!i.viewedAt })),
    helper: r.helperId ? helpersRaw.find((h) => h.id === r.helperId)?.name ?? null : null,
  }));
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="🙋 Demandes de l'équipe" subtitle="Une demande, un rendez-vous ou un renfort à pourvoir : chacun indique s'il est dispo, puis on attribue et on crée la prestation en un clic." />
      <div className="flex flex-wrap items-start gap-3"><TeamRequestForm key={sp.renfort ?? "new"} prefill={prefill} /></div>
      <Fold id="helpers" title={<>🤝 Renforts extérieurs <span className="ml-1 badge bg-slate-100 text-slate-600">{helpers.filter((h) => h.active).length}</span></>} summary="sans compte, invités par SMS / WhatsApp / e-mail">
        <HelperBook helpers={helpers} />
      </Fold>
      {view.length === 0 ? <p className="card p-8 text-center text-sm text-slate-500">Aucune demande en cours.</p> : view.map((r) => <TeamRequestCard key={r.id} r={r} helpers={helpers} me={u.id} manager={u.role === "ADMIN" || u.role === "MANAGER"} base={baseUrl()} />)}
      <a href={all ? "/equipe/demandes" : "?voir=tout"} className="block text-center text-sm text-link-600 hover:underline">{all ? "Masquer les anciennes demandes" : "Voir aussi les anciennes demandes"}</a>
    </div>
  );
}
