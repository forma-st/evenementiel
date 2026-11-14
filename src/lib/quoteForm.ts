import { db } from "./db";
import { CATALOG_CATEGORIES, catalogCategory } from "./presta";

/** Listes nécessaires à l'éditeur de devis. */
export async function quoteFormData() {
  const [clients, dossiers, catalog] = await Promise.all([
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.dossier.findMany({ where: { status: { notIn: ["PERDU", "CLOTURE"] } }, select: { id: true, reference: true, title: true, clientId: true }, orderBy: { createdAt: "desc" } }),
    db.catalogItem.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { label: "asc" }] }),
  ]);
  const order = CATALOG_CATEGORIES.map((c) => c.id as string);
  return {
    clients,
    dossiers: dossiers.map((d) => ({ id: d.id, clientId: d.clientId, title: d.title, label: `${d.reference} — ${d.title}` })),
    catalog: catalog
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.position - b.position)
      .map((c) => ({ id: c.id, category: c.category, categoryLabel: catalogCategory(c.category), label: c.label, description: c.description, unit: c.unit, unitPrice: c.unitPrice, vatRate: c.vatRate })),
  };
}
