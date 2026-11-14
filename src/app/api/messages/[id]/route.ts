import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { toChat } from "@/lib/chat";

/** Nouveaux messages d'une conversation (après ?after=ISO) ; marque la conversation comme lue. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u || u.role === "CLIENT") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const m = await db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: id, userId: u.id } } });
  if (!m) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const after = new URL(req.url).searchParams.get("after");
  // sans « after » : les 100 derniers messages ; avec « after » : les nouveaux depuis cette date
  const messages = after
    ? await db.message.findMany({ where: { conversationId: id, createdAt: { gt: new Date(after) } }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 200 })
    : (await db.message.findMany({ where: { conversationId: id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 })).reverse();
  await db.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { lastReadAt: new Date() } });
  return NextResponse.json({ messages: messages.map(toChat) });
}
