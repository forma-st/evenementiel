import { db } from "./db";

export type ChatMessage = { id: string; body: string; createdAt: string; userId: string | null; userName: string };

export const toChat = (m: { id: string; body: string; createdAt: Date; userId: string | null; user: { name: string } | null }): ChatMessage => ({
  id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), userId: m.userId, userName: m.user?.name ?? "Ancien membre",
});

/** Conversations d'un utilisateur, avec nombre de messages non lus. */
export async function conversationsFor(userId: string) {
  const memberships = await db.conversationMember.findMany({
    where: { userId },
    include: { conversation: { include: { members: { include: { user: { select: { id: true, name: true, active: true } } } } } } },
    orderBy: { conversation: { lastMessageAt: "desc" } },
  });
  return Promise.all(
    memberships.map(async (m) => {
      const c = m.conversation;
      const other = c.kind === "DIRECT" ? c.members.find((x) => x.userId !== userId)?.user : null;
      const unread = await db.message.count({ where: { conversationId: c.id, createdAt: { gt: m.lastReadAt }, NOT: { userId } } });
      return {
        id: c.id,
        kind: c.kind,
        name: c.kind === "DIRECT" ? other?.name ?? "Conversation" : `# ${c.name}`,
        members: c.members.length,
        unread,
        lastMessageAt: c.lastMessageAt.toISOString(),
      };
    }),
  );
}

export async function getOrCreateDirect(a: string, b: string) {
  const existing = await db.conversation.findFirst({
    where: { kind: "DIRECT", AND: [{ members: { some: { userId: a } } }, { members: { some: { userId: b } } }] },
  });
  if (existing) return existing;
  return db.conversation.create({ data: { kind: "DIRECT", members: { create: [{ userId: a }, { userId: b }] } } });
}
