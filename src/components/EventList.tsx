import Link from "next/link";
import { eventType } from "@/lib/events";
import { date, time } from "@/lib/format";
import { Empty } from "./ui";

type Ev = { id: string; title: string; type: string; start: Date; end: Date; allDay: boolean; report: string | null; attendees: { user: { name: string } }[] };

/** Événements d'un client ou d'un dossier : à venir puis passés (avec compte-rendu). */
export function EventList({ events, newHref }: { events: Ev[]; newHref: string }) {
  const now = new Date();
  const upcoming = events.filter((e) => e.end >= now).sort((a, b) => +a.start - +b.start);
  const past = events.filter((e) => e.end < now).sort((a, b) => +b.start - +a.start);
  const Row = ({ e }: { e: Ev }) => {
    const t = eventType(e.type);
    return (
      <li>
        <Link href={`/agenda/${e.id}`} className="flex items-start gap-3 py-2.5 hover:text-brand-700">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{t.icon} {e.title}</div>
            <div className="text-xs text-slate-500">
              {date(e.start)}{!e.allDay && ` · ${time(e.start)}`} · {e.attendees.map((a) => a.user.name.split(" ")[0]).join(", ")}
            </div>
            {e.report && <p className="mt-1 line-clamp-2 text-xs text-slate-600">📝 {e.report}</p>}
          </div>
          {e.end < now && !e.report && <span className="badge shrink-0 bg-amber-100 text-amber-800">CR à faire</span>}
        </Link>
      </li>
    );
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href={`${newHref}&type=REUNION`} className="btn-secondary py-1.5 text-xs">👥 Réunion</Link>
        <Link href={`${newHref}&type=APPEL`} className="btn-secondary py-1.5 text-xs">☎ Appel</Link>
        <Link href={`${newHref}&type=VISIO`} className="btn-secondary py-1.5 text-xs">🎥 Visio</Link>
        <Link href={`${newHref}&type=RDV`} className="btn-secondary py-1.5 text-xs">🤝 RDV</Link>
      </div>
      {events.length === 0 ? <Empty>Aucun événement.</Empty> : (
        <>
          {upcoming.length > 0 && (<><div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">À venir</div><ul className="mb-3 divide-y divide-slate-100">{upcoming.map((e) => <Row key={e.id} e={e} />)}</ul></>)}
          {past.length > 0 && (<><div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Passés</div><ul className="divide-y divide-slate-100">{past.slice(0, 8).map((e) => <Row key={e.id} e={e} />)}</ul></>)}
        </>
      )}
    </div>
  );
}
