import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Empty, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { clearRead, markAllRead } from "./actions";

export const metadata = { title: "Notifications" };

const ICON: Record<string, string> = { TASK: "✓", MENTION: "@", MESSAGE: "💬", EVENT: "▦", QUESTIONNAIRE: "☑", SYSTEM: "ℹ" };

export default async function Notifications({ searchParams }: { searchParams: Promise<{ tout?: string }> }) {
  const u = await requireStaff();
  const { tout } = await searchParams;
  const list = await db.notification.findMany({
    where: { userId: u.id, ...(tout ? {} : { readAt: null }) },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  const unread = await db.notification.count({ where: { userId: u.id, readAt: null } });
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} non lue(s)`}
        actions={
          <>
            <Link href={tout ? "/notifications" : "/notifications?tout=1"} className="btn-secondary">{tout ? "Non lues seulement" : "Tout afficher"}</Link>
            {unread > 0 && <form action={markAllRead}><button className="btn-primary">Tout marquer comme lu</button></form>}
          </>
        }
      />
      <div className="card divide-y divide-slate-100">
        {list.length === 0 ? (
          <Empty>{tout ? "Aucune notification." : "Vous êtes à jour 🎉"}</Empty>
        ) : (
          list.map((n) => (
            <a key={n.id} href={`/notifications/${n.id}`} className={`flex gap-3 px-5 py-3.5 hover:bg-slate-50 ${n.readAt ? "" : "bg-link-100/30"}`}>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${n.readAt ? "bg-slate-100 text-slate-500" : "bg-link-600 text-white"}`}>
                {ICON[n.type] ?? "•"}
              </span>
              <div className="min-w-0 flex-1">
                <div className={n.readAt ? "text-slate-700" : "font-medium"}>{n.title}</div>
                {n.body && <div className="truncate text-sm text-slate-500">{n.body}</div>}
                <div className="mt-0.5 text-xs text-slate-400">{dateTime(n.createdAt)}</div>
              </div>
              {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-link-600" />}
            </a>
          ))
        )}
      </div>
      {tout && list.some((n) => n.readAt) && (
        <form action={clearRead} className="mt-3 text-right">
          <button className="text-xs text-slate-400 hover:text-slate-700">Effacer les notifications lues</button>
        </form>
      )}
    </div>
  );
}
