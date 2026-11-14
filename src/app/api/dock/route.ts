import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { conversationsFor } from "@/lib/chat";

/** Données du chat flottant : conversations (avec dernier message), notifications récentes, compteurs. */
export async function GET() {
  const u = await currentUser();
  if (!u || u.role === "CLIENT") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const [convs, notifications, unreadNotifs] = await Promise.all([
    conversationsFor(u.id),
    db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  const ids = convs.map((c) => c.id);
  const [lasts, members] = await Promise.all([
    Promise.all(ids.map((id) => db.message.findFirst({ where: { conversationId: id }, orderBy: { createdAt: "desc" }, select: { id: true, body: true, createdAt: true, userId: true, user: { select: { name: true } } } }))),
    db.conversationMember.findMany({ where: { conversationId: { in: ids } }, select: { conversationId: true, user: { select: { id: true, name: true } } } }),
  ]);
  return NextResponse.json({
    me: u.id,
    conversations: convs.map((c, i) => ({
      ...c,
      last: lasts[i] ? { id: lasts[i]!.id, body: lasts[i]!.body.slice(0, 120), at: lasts[i]!.createdAt.toISOString(), mine: lasts[i]!.userId === u.id, author: lasts[i]!.user?.name ?? "" } : null,
      people: members.filter((m) => m.conversationId === c.id).map((m) => m.user),
    })),
    notifications: notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.readAt, at: n.createdAt.toISOString() })),
    unreadNotifs,
    unreadMessages: convs.reduce((a, c) => a + c.unread, 0),
  });
}
