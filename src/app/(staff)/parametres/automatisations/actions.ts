"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { runScheduled, type AutomationAction } from "@/lib/automations";

async function requireManager() {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") throw new ForbiddenError("gérer les automatisations");
  return u;
}

export type RuleInput = { name: string; trigger: string; toStatus: string; offsetDays: number; onlyStatuses: string; eventTypes: string; active: boolean; actions: AutomationAction[] };

const valid = (a: AutomationAction) => {
  switch (a.kind) {
    case "CREATE_TASK": return !!a.title.trim();
    case "SEND_QUESTIONNAIRE": return !!a.questionnaireId;
    case "SEND_EMAIL": return !!a.templateId;
    case "SET_STATUS": return !!a.status;
    case "CREATE_PAYMENTS": return true;
    default: return !!a.message.trim();
  }
};

export async function saveRule(id: string | null, data: RuleInput) {
  await requireManager();
  const clean = {
    name: data.name.trim() || "Règle sans nom",
    trigger: data.trigger,
    toStatus: data.trigger === "STATUS" ? data.toStatus : "",
    offsetDays: Math.round(Number(data.offsetDays) || 0),
    onlyStatuses: data.onlyStatuses,
    eventTypes: data.eventTypes,
    active: data.active,
    actions: JSON.stringify(data.actions.filter(valid)),
  };
  if (id) await db.automationRule.update({ where: { id }, data: clean });
  else await db.automationRule.create({ data: clean });
  revalidatePath("/parametres/automatisations");
  return { ok: true };
}

export async function toggleRule(id: string, active: boolean) {
  await requireManager();
  await db.automationRule.update({ where: { id }, data: { active } });
  revalidatePath("/parametres/automatisations");
}

export async function deleteRule(id: string) {
  await requireManager();
  await db.automationRule.delete({ where: { id } });
  revalidatePath("/parametres/automatisations");
}

/** Lance tout de suite la vérification quotidienne (J-x, relances, retards de paiement). */
export async function runNow() {
  await requireManager();
  const r = await runScheduled();
  revalidatePath("/parametres/automatisations");
  return r;
}
