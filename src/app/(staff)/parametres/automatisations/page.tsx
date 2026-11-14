import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { parseActions } from "@/lib/automations";
import { RulesManager } from "@/components/RulesManager";
import { dateTime } from "@/lib/format";
import { isMailConfigured } from "@/lib/mail";

export const metadata = { title: "Automatisations" };

export default async function Automations() {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") redirect("/parametres/compte");
  const [rules, users, questionnaires, templates, last, runs] = await Promise.all([
    db.automationRule.findMany({ orderBy: [{ offsetDays: "asc" }, { createdAt: "asc" }] }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.questionnaire.findMany({ where: { archived: false }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.emailTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.setting.findUnique({ where: { key: "automations.lastRun" } }),
    db.automationRun.groupBy({ by: ["ruleId"], _count: true }),
  ]);
  return (
    <RulesManager
      rules={rules.map((r) => ({ ...r, actions: parseActions(r.actions), runs: runs.find((x) => x.ruleId === r.id)?._count ?? 0 }))}
      users={users}
      questionnaires={questionnaires}
      templates={templates}
      lastRun={last ? dateTime(last.value) : null}
      mail={isMailConfigured()}
    />
  );
}
