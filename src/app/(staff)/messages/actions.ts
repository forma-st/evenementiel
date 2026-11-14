"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { getOrCreateDirect, toChat, type ChatMessage } from "@/lib/chat";
import { findMentions, notify } from "@/lib/notify";

async function membership(conversationId: string, userId: string) {
  const m = await db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!m) throw new Error("Vous ne faites pas partie de cette conversation.");
  return m;
}

export async function sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const u = await requireStaff();
  await membership(conversationId, u.id);
  const text = body.trim().slice(0, 5000);
  if (!text) throw new Error("Message vide");
  const msg = await db.message.create({ data: { conversationId, userId: u.id, body: text }, include: { user: { select: { name: true } } } });
  const now = new Date();
  await Promise.all([
    db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    db.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: u.id } }, data: { lastReadAt: now } }),
  ]);
  // @mentions -> notification
  if (text.includes("@")) {
    const conv = await db.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { members: { include: { user: { select: { id: true, name: true } } } } } });
    const ids = findMentions(text, conv.members.map((m) => m.user));
    await notify(ids, {
      type: "MENTION",
      title: `${u.name} vous a mentionné${conv.kind === "CHANNEL" ? ` dans #${conv.name}` : ""}`,
      body: text.slice(0, 140),
      link: `/messages/${conversationId}`,
    }, u.id);
  }
  return toChat(msg);
}

export async function createChannel(f: FormData) {
  const u = await requireStaff();
  const name = String(f.get("name") || "").trim().replace(/^#\s*/, "").slice(0, 60);
  if (!name) return;
  const ids = [...new Set([u.id, ...f.getAll("members").map(String)])];
  const c = await db.conversation.create({ data: { kind: "CHANNEL", name, members: { create: ids.map((userId) => ({ userId })) } } });
  await notify(ids, { type: "MESSAGE", title: `${u.name} vous a ajouté au canal #${name}`, link: `/messages/${c.id}` }, u.id);
  redirect(`/messages/${c.id}`);
}

export async function openDirect(otherId: string) {
  const u = await requireStaff();
  if (otherId === u.id) return;
  const c = await getOrCreateDirect(u.id, otherId);
  redirect(`/messages/${c.id}`);
}

export async function leaveChannel(conversationId: string) {
  const u = await requireStaff();
  const c = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!c || c.kind !== "CHANNEL" || c.name === "Général") return;
  await db.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: u.id } } });
  revalidatePath("/messages");
  redirect("/messages");
}
