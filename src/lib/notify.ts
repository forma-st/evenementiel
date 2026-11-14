import { db } from "./db";

export type NotifType = "TASK" | "MENTION" | "MESSAGE" | "EVENT" | "QUESTIONNAIRE" | "SYSTEM";

/** Crée une notification pour chaque destinataire (sauf l'auteur de l'action). */
export async function notify(
  userIds: (string | null | undefined)[],
  n: { type: NotifType; title: string; body?: string | null; link?: string | null },
  actorId?: string | null,
) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x && x !== actorId))];
  if (!ids.length) return;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...n, body: n.body ?? null, link: n.link ?? null })) });
}

/** Repère les @mentions (« @Julie » ou « @Julie Martin ») parmi les membres de l'équipe. */
export function findMentions(text: string, users: { id: string; name: string }[]) {
  const low = text.toLowerCase();
  return users
    .filter((u) => {
      const full = u.name.toLowerCase();
      const first = full.split(" ")[0];
      return low.includes("@" + full) || new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(low);
    })
    .map((u) => u.id);
}
