"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { fromParis } from "@/lib/format";
import { INTERNAL_CLIENT } from "@/lib/presta";
import { parseGear } from "@/lib/gearPick";
import { nextReference } from "@/lib/reference";
import { syncPrestationEvent } from "@/lib/prestaSync";
import { notify } from "@/lib/notify";

export type QuickLoanState = { error?: string } | null;
const s = (f: FormData, k: string) => { const v = f.get(k); return v == null || String(v).trim() === "" ? null : String(v).trim(); };
const day = /^\d{4}-\d{2}-\d{2}$/, hm = /^\d{2}:\d{2}$/;

/** Sortie express : prêt gratuit (équipe, associé, famille), matériel vérifié, remis tout de suite si coché. */
export async function quickLoan(_: QuickLoanState, f: FormData): Promise<QuickLoanState> {
  const u = await requireStaff();
  const sd = s(f, "startDate") ?? "", st = s(f, "startTime") ?? "", ed = s(f, "endDate") ?? "", et = s(f, "endTime") ?? "";
  if (!day.test(sd) || !day.test(ed) || !hm.test(st) || !hm.test(et)) return { error: "Indiquez la sortie et le retour prévu." };
  const start = fromParis(sd, st), end = fromParis(ed, et);
  if (end <= start) return { error: "Le retour doit être après la sortie." };
  const picked = await parseGear(f, start, end);
  if ("error" in picked) return { error: picked.error };
  if (!picked.items.length) return { error: "Choisissez au moins un matériel." };

  // emprunteur : membre de l'équipe, client / associé existant, ou nouvelle fiche
  const who = s(f, "borrower") ?? "";
  let clientId: string, assigneeId: string | null = u.id, name: string;
  if (who.startsWith("user:")) {
    const m = await db.user.findFirst({ where: { id: who.slice(5), role: { not: "CLIENT" } }, select: { id: true, name: true } });
    if (!m) return { error: "Membre de l'équipe introuvable." };
    const ex = await db.client.findFirst({ where: { name: INTERNAL_CLIENT }, select: { id: true } });
    clientId = ex?.id ?? (await db.client.create({ data: { type: "COMPANY", name: INTERNAL_CLIENT, notes: "Fiche technique : prêts de matériel à l'équipe.", ownerId: u.id } })).id;
    assigneeId = m.id; name = m.name;
  } else if (who.startsWith("client:")) {
    const c = await db.client.findUnique({ where: { id: who.slice(7) }, select: { id: true, name: true } });
    if (!c) return { error: "Emprunteur introuvable." };
    clientId = c.id; name = c.name;
  } else if (who === "new") {
    const n = s(f, "newName");
    if (!n) return { error: "Indiquez le nom de l'emprunteur." };
    const c = await db.client.create({ data: { type: "INDIVIDUAL", name: n.slice(0, 120), phone: s(f, "newPhone")?.slice(0, 40) ?? null, notes: "Associé / proche : prêts de matériel.", ownerId: u.id } });
    clientId = c.id; name = c.name;
  } else return { error: "À qui prêtez-vous le matériel ?" };

  const notes = s(f, "notes")?.slice(0, 2000) ?? null;
  const now = s(f, "handNow") === "on";
  const eq = await db.equipment.findMany({ where: { id: { in: picked.items.map((i) => i.id) } }, select: { id: true, name: true } });
  const d = await db.dossier.create({
    data: {
      reference: await nextReference(), title: `Prêt — ${name}`, eventType: "PRET", status: "CONFIRME", clientId, assigneeId,
      eventStart: start, eventEnd: end, description: notes, depositPercent: 0, services: "",
      venueName: s(f, "place")?.slice(0, 200) ?? null,
      equipment: { create: picked.items.map((i) => ({ equipmentId: i.id, quantity: i.qty })) },
      checkout: now ? JSON.stringify({ at: new Date().toISOString(), by: u.name, items: picked.items.map((i) => ({ id: i.id, name: eq.find((e) => e.id === i.id)?.name ?? "", qty: i.qty, ok: true })), notes: notes ?? "" }) : null,
    },
  });
  const units = picked.items.reduce((a, i) => a + i.qty, 0);
  await db.activity.create({ data: { dossierId: d.id, userId: u.id, kind: "STATUS", body: `🤝 Prêt à ${name} : ${units} unité(s)${now ? ", matériel remis" : ""}` } });
  if (assigneeId !== u.id) await notify([assigneeId], { type: "TASK", title: `${u.name} vous prête du matériel : « ${d.title} »`, link: `/prestations/${d.id}` }, u.id);
  await syncPrestationEvent(d.id);
  revalidatePath("/materiel");
  redirect(s(f, "signNow") === "on" ? `/materiel/bon/${d.id}` : `/prestations/${d.id}`);
}

/** Retour en un clic : tout est rendu en bon état ; un prêt passe en « Réalisée » et libère le matériel. */
export async function quickReturn(dossierId: string) {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, include: { equipment: { include: { equipment: { select: { name: true } } } } } });
  if (!d.checkout || d.checkin) return;
  const items = d.equipment.map((x) => ({ id: x.equipmentId, name: x.equipment.name, qty: x.quantity, returned: x.quantity, damaged: 0, note: "" }));
  await db.dossier.update({ where: { id: dossierId }, data: { checkin: JSON.stringify({ at: new Date().toISOString(), by: u.name, items, notes: "", damages: 0 }), ...(d.eventType === "PRET" ? { status: "REALISE", eventEnd: d.eventEnd && d.eventStart && d.eventEnd > new Date() && d.eventStart < new Date() ? new Date() : d.eventEnd } : {}) } });
  await db.activity.create({ data: { dossierId, userId: u.id, kind: "STATUS", body: "📦 Retour du matériel : tout est rendu en bon état" } });
  await syncPrestationEvent(dossierId);
  revalidatePath("/materiel");
  revalidatePath(`/prestations/${dossierId}`);
  revalidatePath("/");
}
