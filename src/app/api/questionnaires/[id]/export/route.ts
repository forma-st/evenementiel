import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { formatAnswer, parseFields } from "@/lib/questionnaire";

const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u || u.role === "CLIENT") return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  const q = await db.questionnaire.findUnique({
    where: { id },
    include: { assignments: { where: { status: "COMPLETE" }, include: { client: true, dossier: true } } },
  });
  if (!q) return new Response("Introuvable", { status: 404 });
  const fields = parseFields(q.fields).filter((f) => f.type !== "section");
  const rows = [
    ["Client", "Dossier", "Date", ...fields.map((f) => f.label)],
    ...q.assignments.map((a) => {
      const ans = a.answers ? JSON.parse(a.answers) : {};
      return [a.client.name, a.dossier?.reference ?? "", a.submittedAt?.toISOString() ?? "", ...fields.map((f) => formatAnswer(f, ans[f.id]))];
    }),
  ];
  const csv = "﻿" + rows.map((r) => r.map((c) => esc(String(c))).join(";")).join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="reponses-${id}.csv"` },
  });
}
