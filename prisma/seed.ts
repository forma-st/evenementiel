/** Données de démonstration (à lancer après `npm run db:migrate-data`). */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const db = new PrismaClient();
const tok = () => randomBytes(18).toString("base64url");

async function main() {
  if (await db.user.count()) { console.log("Base déjà initialisée."); return; }
  const hash = (p: string) => bcrypt.hash(p, 10);
  const admin = await db.user.create({ data: { email: "admin@exemple.fr", name: "Max DJ", role: "ADMIN", jobTitle: "DJ / gérant", passwordHash: await hash("admin1234") } });
  const lea = await db.user.create({ data: { email: "lea@exemple.fr", name: "Léa Photo", role: "MANAGER", jobTitle: "Photographe", passwordHash: await hash("lea12345") } });
  await db.setting.create({ data: { key: "company", value: JSON.stringify({ name: "Studio Nuit Blanche", tagline: "DJ · Sonorisation · Photographie", address: "12 rue des Lilas, 95000 Cergy", siret: "123 456 789 00012", phone: "06 12 34 56 78", email: "contact@exemple.fr", web: "www.exemple.fr", iban: "FR76 0000 0000 0000 0000 0000 000", vatExempt: false, reviewUrl: "https://g.page/r/exemple", quoteFooter: "Devis valable 30 jours. Réservation de la date à réception du contrat signé et de l'acompte." }) } });

  await db.setting.create({ data: { key: "urssaf", value: JSON.stringify({ activity: "BIC_SERVICES", frequency: "TRIMESTRIELLE", versementLiberatoire: false, acreUntil: "", acreFactor: 0.75, rate: null, cfp: null, vl: null, creationDate: `${new Date().getFullYear()}-09-01` }) } });
  const julie = await db.client.create({ data: { type: "INDIVIDUAL", name: "Julie Martin & Thomas Roux", email: "julie.martin@exemple.fr", phone: "06 11 22 33 44", address: "4 allée des Roses", postalCode: "78000", city: "Versailles", ownerId: admin.id } });
  const acme = await db.client.create({ data: { type: "COMPANY", name: "Acme Conseil", email: "events@acme.exemple.fr", phone: "01 23 45 67 89", city: "Paris", ownerId: admin.id } });
  const sami = await db.client.create({ data: { type: "INDIVIDUAL", name: "Sami Benali", email: "sami@exemple.fr", city: "Pontoise", ownerId: admin.id } });
  await db.contact.create({ data: { clientId: acme.id, firstName: "Claire", lastName: "Dubois", email: "claire.dubois@acme.exemple.fr", jobTitle: "Office manager" } });
  await db.user.create({ data: { email: "julie.martin@exemple.fr", name: "Julie Martin", role: "CLIENT", clientId: julie.id, passwordHash: await hash("client1234") } });

  const y = new Date().getFullYear();
  const at = (days: number, h: number) => { const d = new Date(Date.now() + days * 864e5); d.setUTCHours(h - 1, 0, 0, 0); return d; };
  const mariage = await db.dossier.create({ data: {
    reference: `P${y}-0001`, title: "Mariage de Julie & Thomas", status: "CONFIRME", eventType: "MARIAGE", services: "DJ,SONO,LUMIERE,PHOTO",
    eventStart: at(40, 17), eventEnd: at(41, 4), setupTime: "14:00", venueName: "Domaine des Oliviers", venueAddress: "Route de Chevreuse", venueCity: "Dampierre", guests: 120,
    venueContact: "Sophie (wedding planner) 06 98 76 54 32", source: "Mariages.net", clientId: julie.id, assigneeId: admin.id, amount: 3420,
  } });
  const soiree = await db.dossier.create({ data: {
    reference: `P${y}-0002`, title: "Soirée de fin d'année Acme", status: "DEVIS_ENVOYE", eventType: "ENTREPRISE", services: "DJ,SONO,PHOTOBOOTH",
    eventStart: at(25, 19), eventEnd: at(26, 1), venueName: "Péniche Le Quai", venueCity: "Paris", guests: 80, source: "Recommandation lieu / traiteur", clientId: acme.id, assigneeId: admin.id, amount: 1800,
  } });
  await db.dossier.create({ data: { reference: `P${y}-0003`, title: "Anniversaire 40 ans de Sami", status: "DEMANDE", eventType: "ANNIVERSAIRE", services: "DJ,SONO", eventStart: at(70, 20), eventEnd: at(71, 2), venueCity: "Pontoise", guests: 60, source: "Instagram", clientId: sami.id } });
  const passe = await db.dossier.create({ data: { reference: `P${y}-0004`, title: "Séance photo couple Julie & Thomas", status: "REALISE", eventType: "SEANCE", services: "PHOTO", eventStart: at(-20, 16), eventEnd: at(-20, 18), venueName: "Parc de Versailles", clientId: julie.id, assigneeId: lea.id, amount: 250 } });

  const lines = [
    { label: "Formule Mariage Complète", description: "Cérémonie laïque sonorisée, vin d'honneur, repas et soirée dansante.", quantity: 1, unitPrice: 1490, vatRate: 20, unit: "forfait" },
    { label: "Mise en lumière de la salle", quantity: 1, unitPrice: 180, vatRate: 20, unit: "forfait" },
    { label: "Formule Photo Reportage — journée", quantity: 1, unitPrice: 1180, vatRate: 20, unit: "forfait" },
  ];
  const q1 = await db.quote.create({ data: { clientId: julie.id, dossierId: mariage.id, label: "Mariage — DJ, lumières et photo", number: `DEV-${y}-0001`, token: tok(), lines: JSON.stringify(lines), totalHT: 2850, totalTTC: 3420, status: "ACCEPTE", sentAt: at(-30, 10), viewedAt: at(-29, 10), answeredAt: at(-28, 10), validUntil: at(0, 12), issuedAt: at(-30, 10) } });
  await db.quote.create({ data: { clientId: acme.id, dossierId: soiree.id, label: "Soirée de fin d'année — DJ et photobooth", number: `DEV-${y}-0002`, token: tok(), lines: JSON.stringify([{ label: "Formule Soirée — DJ + sono + lumières", quantity: 1, unitPrice: 990, vatRate: 20, unit: "forfait" }, { label: "Photobooth avec impressions illimitées", quantity: 1, unitPrice: 390, vatRate: 20, unit: "forfait" }]), totalHT: 1380, totalTTC: 1656, status: "ENVOYE", sentAt: at(-8, 10), validUntil: at(22, 12), issuedAt: at(-8, 10) } });
  await db.payment.createMany({ data: [
    { dossierId: mariage.id, label: "Acompte 30 %", amount: 1026, dueDate: at(-25, 12), paidAt: at(-26, 12), method: "Virement" },
    { dossierId: mariage.id, label: "Solde", amount: 2394, dueDate: at(33, 12) },
  ] });
  await db.activity.createMany({ data: [
    { dossierId: mariage.id, userId: admin.id, kind: "STATUS", body: "Prestation créée" },
    { dossierId: mariage.id, kind: "QUOTE", body: `✅ Devis ${q1.number} accepté en ligne par Julie Martin` },
    { dossierId: mariage.id, userId: admin.id, kind: "NOTE", body: "Rendez-vous découverte : très festif, années 80 + latino. Première danse sur « La Vie en rose »." },
  ] });
  const eq = await db.equipment.findMany();
  for (const e of eq.slice(0, 4)) await db.dossierEquipment.create({ data: { dossierId: mariage.id, equipmentId: e.id, quantity: Math.min(2, e.quantity) } });
  await db.gallery.create({ data: { title: "Séance couple Julie & Thomas", token: tok(), password: "ROSE24", status: "BROUILLON", clientId: julie.id, dossierId: passe.id, message: "Merci pour ce joli moment au parc !", expiresAt: at(90, 23) } });
  await db.task.createMany({ data: [
    { title: "Rappeler Acme pour le devis", type: "APPEL", priority: "HAUTE", dueDate: at(1, 12), assigneeId: admin.id, clientId: acme.id, dossierId: soiree.id, createdById: admin.id },
    { title: "Retoucher la séance couple", type: "TACHE", priority: "NORMALE", dueDate: at(3, 12), assigneeId: lea.id, clientId: julie.id, dossierId: passe.id, createdById: admin.id },
  ] });
  const { syncPrestationEvent } = await import("../src/lib/prestaSync");
  for (const d of await db.dossier.findMany()) await syncPrestationEvent(d.id);
  await db.event.create({ data: { title: "Visite technique Domaine des Oliviers", type: "VISITE", start: at(10, 15), end: at(10, 16), location: "Dampierre", clientId: julie.id, dossierId: mariage.id, organizerId: admin.id, attendees: { create: [{ userId: admin.id }] } } });
  console.log("Données de démonstration créées.");
}

main().finally(() => db.$disconnect());
