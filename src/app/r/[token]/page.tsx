import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { InviteAnswer } from "@/components/InviteAnswer";
import { getCompany } from "@/lib/company";
import { eventKind } from "@/lib/presta";
import { loadInvite } from "@/lib/helperInvite";
import { answerInvite } from "./actions";

export const metadata = { title: "Demande de renfort", robots: { index: false } };
export const dynamic = "force-dynamic";
const fday = (d: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d}T12:00:00`));

/** Page du renfort extérieur (lien personnel, sans compte) : demande, réponse, puis fiche mission une fois retenu. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await loadInvite(token);
  if (!inv) notFound();
  if (!inv.viewedAt) await db.helperInvite.update({ where: { id: inv.id }, data: { viewedAt: new Date() } });
  const r = inv.request;
  const [c, author, d] = await Promise.all([
    getCompany(),
    db.user.findUnique({ where: { id: r.createdById }, select: { name: true, phone: true } }),
    r.dossierId ? db.dossier.findUnique({ where: { id: r.dossierId }, select: { venueName: true, venueAddress: true, venueCity: true, venueContact: true, setupTime: true } }) : null,
  ]);
  const mine = r.helperId === inv.helperId;
  const taken = !mine && r.status !== "OUVERTE";
  const place = [d?.venueName ?? r.venue, d?.venueAddress, d?.venueCity ?? r.city].filter(Boolean).join(", ");
  return (
    <div className="min-h-screen">
      <header className="nav-navy"><div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4"><Logo className="h-10" /><span className="text-sm opacity-80">Bonjour {inv.helper.name} 👋</span></div></header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {mine && <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200"><div className="text-lg font-semibold">✅ C&apos;est confirmé, merci !</div><div className="text-sm">Voici toutes les infos de la mission.</div></div>}
        {taken && <div className="rounded-2xl bg-slate-100 p-4 text-slate-700">{r.status === "ANNULEE" ? "Cette demande a été annulée." : "La mission a été pourvue. Merci pour votre réponse, à une prochaine fois !"}</div>}
        <article className="card space-y-3 p-5">
          <div className="text-sm text-slate-500">{c.name} · {r.kind === "RENFORT" ? "🛠 Renfort / installation" : `${eventKind(r.eventType).icon} ${eventKind(r.eventType).label}`}</div>
          <h1 className="text-xl font-semibold">{r.title}</h1>
          <ul className="space-y-1.5 text-[15px]">
            {r.date && <li className="first-letter:uppercase">📅 {fday(r.date)}</li>}
            {(r.startTime || d?.setupTime) && <li>🕒 {d?.setupTime && mine ? `install à partir de ${d.setupTime}, ` : ""}{r.startTime ? `de ${r.startTime}` : ""}{r.endTime ? ` à ${r.endTime}` : ""}</li>}
            {(mine ? place : r.city) && <li>📍 {mine ? place : r.city}</li>}
            {r.guests && <li>👥 {r.guests} invités</li>}
            {mine && d?.venueContact && <li>☎️ Sur place : {d.venueContact}</li>}
          </ul>
          {r.notes && <p className="rounded-xl bg-slate-50 p-3 text-sm whitespace-pre-wrap">{r.notes}</p>}
          <p className="text-sm text-slate-500">Contact : {author?.name}{author?.phone ? <> · <a href={`tel:${author.phone.replace(/\s/g, "")}`} className="text-link-600">{author.phone}</a></> : ""}</p>
          {mine && r.date && <a href={`/r/${token}/ics`} className="btn-primary">📅 Ajouter à mon agenda</a>}
        </article>
        {r.status === "OUVERTE" && (
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">Êtes-vous disponible ?</h2>
            <InviteAnswer current={inv.answer} comment={inv.comment ?? ""} answer={answerInvite.bind(null, token)} />
          </section>
        )}
        <p className="text-center text-xs text-slate-400">Lien personnel : ne le partagez pas. Aucun compte n&apos;est nécessaire.</p>
      </main>
    </div>
  );
}
