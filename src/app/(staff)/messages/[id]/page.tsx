import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { conversationsFor, toChat } from "@/lib/chat";
import { ChatRoom } from "@/components/ChatRoom";
import { ConvSelect } from "@/components/ConvSelect";
import { createChannel, leaveChannel, openDirect } from "../actions";

export const metadata = { title: "Messages" };

export default async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff();
  const member = await db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: id, userId: me.id } } });
  if (!member) notFound();
  const [conv, list, team, messages] = await Promise.all([
    db.conversation.findUniqueOrThrow({ where: { id }, include: { members: { include: { user: { select: { id: true, name: true } } } } } }),
    conversationsFor(me.id),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true, jobTitle: true }, orderBy: { name: "asc" } }),
    db.message.findMany({ where: { conversationId: id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  await db.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: me.id } }, data: { lastReadAt: new Date() } });

  const channels = list.filter((c) => c.kind === "CHANNEL");
  const directs = list.filter((c) => c.kind === "DIRECT");
  const current = list.find((c) => c.id === id)!;
  const others = team.filter((u) => u.id !== me.id);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-7rem)] md:-mx-8 md:-my-8 md:h-screen">
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-3 sm:flex">
        <div className="mb-1 px-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Canaux</div>
        {channels.map((c) => <ConvLink key={c.id} c={c} active={c.id === id} />)}
        <details className="mt-1 px-2">
          <summary className="cursor-pointer text-sm text-link-600">+ Nouveau canal</summary>
          <form action={createChannel} className="mt-2 space-y-2">
            <input name="name" placeholder="Nom du canal" required className="input py-1.5" />
            <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {others.map((u) => (
                <label key={u.id} className="flex items-center gap-2"><input type="checkbox" name="members" value={u.id} className="accent-brand-600" /> {u.name}</label>
              ))}
            </div>
            <button className="btn-primary w-full py-1.5">Créer</button>
          </form>
        </details>

        <div className="mt-5 mb-1 px-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Messages privés</div>
        {directs.map((c) => <ConvLink key={c.id} c={c} active={c.id === id} />)}
        {others.filter((u) => !directs.some((d) => d.name === u.name)).map((u) => (
          <form key={u.id} action={openDirect.bind(null, u.id)}>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100">
              <span className="h-2 w-2 rounded-full bg-slate-300" /> {u.name}
            </button>
          </form>
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h1 className="font-semibold">{current.name}</h1>
            <div className="text-xs text-slate-500">
              {conv.kind === "CHANNEL" ? conv.members.map((m) => m.user.name).join(", ") : "Message privé"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ConvSelect value={id} options={list} />
            {conv.kind === "CHANNEL" && conv.name !== "Général" && (
              <form action={leaveChannel.bind(null, id)}><button className="text-xs text-slate-400 hover:text-brand-600">Quitter le canal</button></form>
            )}
          </div>
        </header>
        <ChatRoom
          key={id}
          conversationId={id}
          me={me.id}
          members={conv.members.map((m) => m.user)}
          initial={messages.reverse().map(toChat)}
        />
      </section>
    </div>
  );
}

function ConvLink({ c, active }: { c: { id: string; name: string; unread: number }; active: boolean }) {
  return (
    <Link href={`/messages/${c.id}`} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-100"}`}>
      <span className="truncate">{c.name}</span>
      {c.unread > 0 && !active && <span className="ml-auto rounded-full bg-link-600 px-1.5 text-[10px] font-semibold text-white">{c.unread}</span>}
    </Link>
  );
}
