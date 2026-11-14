"use client";
import { GroupedBars, HBars } from "./Charts";

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const eurAxis = (n: number) => (n >= 1000 ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n / 1000)} k€` : `${Math.round(n)} €`);
const int = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function RevenueChart({ months }: { months: { label: string; sent: number; accepted: number }[] }) {
  return (
    <GroupedBars
      rows={months}
      series={[{ key: "sent", label: "Devis émis (HT)" }, { key: "accepted", label: "Devis acceptés (HT)" }]}
      format={eur}
      axisFormat={eurAxis}
      first="Mois"
    />
  );
}

export function TasksChart({ weeks }: { weeks: { label: string; done: number; created: number }[] }) {
  return (
    <GroupedBars
      rows={weeks}
      series={[{ key: "created", label: "Tâches créées" }, { key: "done", label: "Tâches terminées" }]}
      format={int}
      axisFormat={(n) => (Number.isInteger(n) ? int(n) : "")}
      first="Semaine du"
      height={210}
      width={520}
    />
  );
}

export function PipelineChart({ rows }: { rows: { id: string; label: string; count: number; amount: number }[] }) {
  return (
    <HBars
      rows={rows.map((r) => ({ label: r.label, value: r.count, href: `/prestations?vue=liste&status=${r.id}`, note: eur(r.amount) }))}
      format={(n) => `${int(n)} dossier${n > 1 ? "s" : ""}`}
      detail={(r) => `${r.label} : ${r.value} dossier(s) · ${r.note} estimés`}
    />
  );
}
