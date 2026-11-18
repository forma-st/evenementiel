import { db } from "./db";
import { startOfDay } from "./tasks";
import { getCompany } from "./company";
import type { Badges } from "@/components/Sidebar";

/** Compteurs du menu, en un seul aller-retour vers la base (deux si la messagerie est activée et qu'il y a des conversations). */
export async function badgesFor(userId: string): Promise<Badges> {
  const [lateTasks, unreadNotifs, memberships, company] = await Promise.all([
    db.task.count({ where: { assigneeId: userId, status: { not: "FAIT" }, dueDate: { lt: startOfDay() } } }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.conversationMember.findMany({ where: { userId }, select: { conversationId: true, lastReadAt: true } }),
    getCompany(),
  ]);
  const unreadMessages = company.teamChat && memberships.length
    ? await db.message.count({
        where: {
          OR: memberships.map((m) => ({ conversationId: m.conversationId, createdAt: { gt: m.lastReadAt } })),
          NOT: { userId },
        },
      })
    : 0;
  return { lateTasks, unreadMessages, unreadNotifs };
}
