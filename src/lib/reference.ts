import { db } from "./db";

/** Prochaine référence de prestation : P2026-0001… */
export async function nextReference() {
  const year = new Date().getFullYear();
  const last = await db.dossier.findFirst({ where: { reference: { startsWith: `P${year}-` } }, orderBy: { reference: "desc" }, select: { reference: true } });
  const n = last ? Number(last.reference.split("-")[1]) || 0 : 0;
  return `P${year}-${String(n + 1).padStart(4, "0")}`;
}
