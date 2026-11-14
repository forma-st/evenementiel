"use server";
import { db } from "@/lib/db";
import { fromParis } from "@/lib/format";
import { runAutomations } from "@/lib/automations";
import { syncPrestationEvent } from "@/lib/prestaSync";
import { notify } from "@/lib/notify";
import { eventKind } from "@/lib/presta";

export type LeadState = { error?: string; ok?: boolean } | null;

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim().slice(0, 2000);

/** Demande de devis publique : client + prestation « Demande » + automatisations. */
export async function submitLead(_: LeadState, f: FormData): Promise<LeadState> {
  if (s(f, "website")) return { ok: true }; // piège à robots
  const name = s(f, "name"), email = s(f, "email").toLowerCase(), phone = s(f, "phone");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Indiquez votre nom et une adresse e-mail valide." };
  const day = s(f, "date");
  const kind = s(f, "eventType") || "AUTRE";
  const actor = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!actor) return { error: "Service indisponible." };

  let client = await db.client.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!client) client = await db.client.create({ data: { type: "INDIVIDUAL", name, email, phone: phone || null, city: s(f, "city") || null, notes: "Créé depuis le formulaire de demande en ligne." } });
  else if (phone && !client.phone) await db.client.update({ where: { id: client.id }, data: { phone } });

  const year = new Date().getFullYear();
  const last = await db.dossier.findFirst({ where: { reference: { startsWith: `P${year}-` } }, orderBy: { reference: "desc" }, select: { reference: true } });
  const ref = `P${year}-${String((last ? Number(last.reference.split("-")[1]) || 0 : 0) + 1).padStart(4, "0")}`;
  const guests = Number(s(f, "guests")) || null;
  const d = await db.dossier.create({
    data: {
      reference: ref,
      title: `${eventKind(kind).label} — ${name}`,
      clientId: client.id,
      status: "DEMANDE",
      eventType: kind,
      services: f.getAll("services").map(String).join(","),
      eventStart: /^\d{4}-\d{2}-\d{2}$/.test(day) ? fromParis(day, "18:00") : null,
      eventEnd: /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(fromParis(day, "18:00").getTime() + 8 * 36e5) : null,
      venueName: s(f, "venue") || null,
      venueCity: s(f, "city") || null,
      guests,
      source: s(f, "source") || "Site internet",
      amount: Number(s(f, "budget")) || null,
      description: s(f, "message") || null,
      assigneeId: client.ownerId ?? null,
    },
  });
  await db.activity.create({ data: { dossierId: d.id, kind: "STATUS", body: "📥 Demande reçue depuis le formulaire en ligne" } });
  await syncPrestationEvent(d.id);
  await runAutomations(d.id, "DEMANDE", actor);
  const managers = await db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, active: true }, select: { id: true } });
  await notify(managers.map((m) => m.id), { type: "SYSTEM", title: `📥 Nouvelle demande : ${d.title}`, body: day ? `Pour le ${day}` : null, link: `/prestations/${d.id}` });
  return { ok: true };
}
