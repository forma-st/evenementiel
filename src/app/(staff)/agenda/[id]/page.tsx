import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { eventWhere, permsFor } from "@/lib/permissions";
import { eventType, googleCalendarLink } from "@/lib/events";
import { longDate, time } from "@/lib/format";
import { ReportEditor } from "@/components/ReportEditor";
import { Back, Card } from "@/components/ui";
import { deleteEvent, saveReport } from "../actions";

export const metadata = { title: "Événement" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();
  const e = await db.event.findFirst({
    where: { id, ...eventWhere(user, await permsFor(user)) },
    include: { client: true, dossier: true, organizer: { select: { name: true } }, attendees: { include: { user: { select: { id: true, name: true } } } } },
  });
  if (!e) notFound();
  const t = eventType(e.type);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const base = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const sameDay = longDate(e.start) === longDate(new Date(e.end.getTime() - 1));
  const when = e.allDay
    ? sameDay ? longDate(e.start) : `du ${longDate(e.start)} au ${longDate(new Date(e.end.getTime() - 1))}`
    : sameDay ? `${longDate(e.start)}, ${time(e.start)} – ${time(e.end)}` : `du ${longDate(e.start)} ${time(e.start)} au ${longDate(e.end)} ${time(e.end)}`;
  const past = e.end < new Date();

  return (
    <div className="max-w-5xl space-y-6">
      <Back href="/agenda">Agenda</Back>
      <div className={`card border-l-4 p-6 ${t.chip.split(" ").find((c) => c.startsWith("border-"))}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className={`badge border ${t.chip}`}>{t.icon} {t.label}</span>
            <h1 className="mt-2 text-2xl font-semibold">{e.title}</h1>
            <p className="mt-1 text-slate-600 first-letter:uppercase">{when}</p>
            {e.location && (
              <p className="mt-1 text-sm">
                {/^https?:\/\//.test(e.location) ? <a href={e.location} target="_blank" className="text-link-600 underline">{e.location}</a>
                  : e.type === "APPEL" ? <a href={`tel:${e.location.replace(/\s/g, "")}`} className="text-link-600">☎ {e.location}</a>
                  : <>📍 {e.location}</>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={googleCalendarLink(e, `${base}/agenda/${e.id}`)} target="_blank" className="btn-secondary">+ Google Agenda</a>
            <Link href={`/agenda/${id}/modifier`} className="btn-primary">Modifier</Link>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Client</dt><dd>{e.client ? <Link href={`/clients/${e.client.id}`} className="text-link-600 hover:underline">{e.client.name}</Link> : "Interne"}</dd></div>
          <div><dt className="text-slate-500">Prestation</dt><dd>{e.dossier ? <Link href={`/prestations/${e.dossier.id}`} className="text-link-600 hover:underline">{e.dossier.reference} · {e.dossier.title}</Link> : "—"}</dd></div>
          <div><dt className="text-slate-500">Participants</dt><dd>{e.attendees.map((a) => a.user.name).join(", ") || "—"}</dd></div>
        </dl>
        {e.description && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">{e.description}</p>}
      </div>

      <Card title={past ? "Compte-rendu" : "Compte-rendu (à compléter après l'événement)"}>
        <ReportEditor initial={e.report ?? ""} onSave={saveReport.bind(null, id)} />
        {e.dossier && <p className="mt-3 text-xs text-slate-500">Le premier enregistrement du compte-rendu est aussi ajouté au journal du dossier {e.dossier.reference}.</p>}
      </Card>

      <form action={deleteEvent.bind(null, id)} className="text-right">
        <button className="text-sm text-slate-400 hover:text-brand-600">Supprimer l'événement (les participants seront prévenus)</button>
      </form>
    </div>
  );
}
