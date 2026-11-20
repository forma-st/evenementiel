import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { TZ, time } from "@/lib/format";

const fullDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);
import { eventKind, servicesLabel } from "@/lib/presta";
import { PrintButton } from "@/components/PrintButton";
import { musicData } from "@/lib/musicServer";

export const metadata = { title: "Feuille de route DJ" };

/** Feuille de route imprimable : horaires, lieu, contacts, déroulé musical, à passer / à éviter, matériel. */
export default async function RunSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertDossierVisible(await requireStaff(), id);
  const d = await db.dossier.findUnique({
    where: { id },
    include: { client: true, assignee: { select: { name: true, phone: true } }, musicPlan: true, equipment: { include: { equipment: { select: { name: true, category: true } } } } },
  });
  if (!d) notFound();
  const m = musicData(d.musicPlan, d.eventType);
  const moments = [...m.moments].sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : 0));
  const k = eventKind(d.eventType);
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-3 py-1"><dt className="w-32 shrink-0 text-slate-500">{label}</dt><dd className="min-w-0 flex-1">{children}</dd></div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-4 print:text-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/prestations/${id}#musique`} className="text-sm text-link-600 hover:underline">← {d.reference}</Link>
        <PrintButton />
      </div>

      <header className="card p-6 print:border-0 print:p-0 print:shadow-none">
        <div className="text-sm text-slate-500">{k.icon} {k.label} · {d.reference}</div>
        <h1 className="text-2xl font-semibold">{d.title}</h1>
        <div className="mt-1 text-lg capitalize">{d.eventStart ? `${fullDate(d.eventStart)} · ${time(d.eventStart)}${d.eventEnd ? ` → ${time(d.eventEnd)}` : ""}` : "Date à définir"}</div>
      </header>

      <section className="card grid gap-6 p-6 sm:grid-cols-2 print:break-inside-avoid print:border print:shadow-none">
        <dl className="text-sm">
          <h2 className="mb-2 font-semibold">Infos pratiques</h2>
          {d.setupTime && <Row label="Installation">à partir de {d.setupTime}</Row>}
          <Row label="Lieu">{d.venueName ?? "—"}{(d.venueAddress || d.venueCity) && <div className="text-slate-600">{[d.venueAddress, d.venueCity].filter(Boolean).join(", ")}</div>}</Row>
          {d.venueContact && <Row label="Sur place">{d.venueContact}</Row>}
          {d.guests && <Row label="Invités">{d.guests}</Row>}
          {d.services && <Row label="Prestations">{servicesLabel(d.services)}</Row>}
          {d.assignee && <Row label="DJ">{d.assignee.name}{d.assignee.phone ? ` · ${d.assignee.phone}` : ""}</Row>}
        </dl>
        <dl className="text-sm">
          <h2 className="mb-2 font-semibold">Client</h2>
          <Row label="Nom">{d.client.name}</Row>
          {d.client.phone && <Row label="Téléphone">{d.client.phone}</Row>}
          {d.client.email && <Row label="E-mail">{d.client.email}</Row>}
          {m.playlistUrl && <Row label="Playlist"><a href={m.playlistUrl} className="break-all text-link-600">{m.playlistUrl}</a></Row>}
        </dl>
      </section>

      <section className="card p-6 print:break-inside-avoid print:border print:shadow-none">
        <h2 className="mb-3 font-semibold">Déroulé</h2>
        {moments.length === 0 ? <p className="text-sm text-slate-500">Aucun moment défini dans le planning musical.</p> : (
          <ol className="divide-y divide-slate-100">
            {moments.map((x) => (
              <li key={x.id} className="grid grid-cols-[70px_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[70px_1fr_1.3fr]">
                <span className="font-semibold tabular-nums">{x.time || "—"}</span>
                <span className="font-medium">{x.label}</span>
                <span className="col-start-2 sm:col-start-auto">{x.song || <span className="text-slate-400">morceau à définir</span>}{x.note && <span className="block text-xs text-slate-500">{x.note}</span>}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <section className="card p-6 print:break-inside-avoid print:border print:shadow-none">
          <h2 className="mb-2 font-semibold text-emerald-700">♥ À passer ({m.mustPlay.length})</h2>
          {m.mustPlay.length === 0 ? <p className="text-sm text-slate-500">—</p> : <ul className="space-y-1 text-sm">{m.mustPlay.map((t) => <li key={t.id}>☐ <b>{t.title}</b>{t.artist && ` — ${t.artist}`}</li>)}</ul>}
        </section>
        <section className="card p-6 print:break-inside-avoid print:border print:shadow-none">
          <h2 className="mb-2 font-semibold text-rose-700">✕ À ne pas passer ({m.doNotPlay.length})</h2>
          {m.doNotPlay.length === 0 ? <p className="text-sm text-slate-500">—</p> : <ul className="space-y-1 text-sm">{m.doNotPlay.map((t) => <li key={t.id}><b>{t.title}</b>{t.artist && ` — ${t.artist}`}</li>)}</ul>}
        </section>
      </div>

      {(m.notes || d.description) && (
        <section className="card space-y-3 p-6 text-sm print:break-inside-avoid print:border print:shadow-none">
          {m.notes && <div><h2 className="mb-1 font-semibold">Ambiance et consignes</h2><p className="whitespace-pre-wrap">{m.notes}</p></div>}
          {d.description && <div><h2 className="mb-1 font-semibold">Notes internes</h2><p className="whitespace-pre-wrap text-slate-600">{d.description}</p></div>}
        </section>
      )}

      {d.equipment.length > 0 && (
        <section className="card p-6 print:break-inside-avoid print:border print:shadow-none">
          <h2 className="mb-2 font-semibold">Matériel</h2>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{d.equipment.map((x) => <li key={x.equipmentId}>☐ {x.quantity} × {x.equipment.name}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
