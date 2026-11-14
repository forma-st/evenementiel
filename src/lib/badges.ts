import { db } from "./db";
import { startOfDay } from "./tasks";
import type { Badges } from "@/components/Sidebar";

export async function badgesFor(userId: string): Promise<Badges> {
  const [lateTasks, unreadNotifs, memberships] = await Promise.all([
    db.task.count({ where: { assigneeId: userId, status: { not: "FAIT" }, dueDate: { lt: startOfDay() } } }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.conversationMember.findMany({ where: { userId }, select: { conversationId: true, lastReadAt: true } }),
  ]);
  const unreadMessages = memberships.length
    ? await db.message.count({
        where: {
          OR: memberships.map((m) => ({ conversationId: m.conversationId, createdAt: { gt: m.lastReadAt } })),
          NOT: { userId },
        },
      })
    : 0;
  return { lateTasks, unreadMessages, unreadNotifs };
}
