import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Back, PageHeader } from "@/components/ui";
import { QuickLoanForm } from "@/components/QuickLoanForm";
import { INTERNAL_CLIENT } from "@/lib/presta";

export const metadata = { title: "Prêter du matériel" };

export default async function QuickLoanPage() {
  const u = await requireStaff();
  const [loans, users, clients] = await Promise.all([
    db.dossier.findMany({ where: { eventType: "PRET" }, orderBy: { createdAt: "desc" }, take: 30, select: { clientId: true, assigneeId: true, createdAt: true, client: { select: { name: true } }, assignee: { select: { name: true } } } }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true, id: { not: u.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.client.findMany({ where: { name: { not: INTERNAL_CLIENT } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  const when = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
  const recent: { key: string; name: string; hint: string }[] = [];
  for (const l of loans) {
    const team = l.client.name === INTERNAL_CLIENT;
    const key = team ? `user:${l.assigneeId}` : `client:${l.clientId}`;
    if (recent.some((r) => r.key === key) || (team && (!l.assignee || l.assigneeId === u.id))) continue;
    recent.push({ key, name: team ? l.assignee!.name : l.client.name, hint: `dernier prêt le ${when(l.createdAt)}` });
    if (recent.length >= 6) break;
  }
  return (
    <div className="max-w-3xl">
      <Back href="/materiel">Matériel</Back>
      <PageHeader title="🤝 Prêter du matériel" subtitle="Pour l'équipe, un associé ou la famille : gratuit, sans devis ni e-mail. Le matériel est bloqué sur les dates et apparaît dans « Matériel sorti »." />
      <QuickLoanForm
        recent={recent}
        team={users.map((x) => ({ key: `user:${x.id}`, name: x.name, hint: "équipe" }))}
        others={clients.map((c) => ({ key: `client:${c.id}`, name: c.name, hint: "" }))}
      />
    </div>
  );
}
