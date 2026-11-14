import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EQUIPMENT_CATEGORIES } from "@/lib/presta";
import { date } from "@/lib/format";
import { startOfDay } from "@/lib/tasks";
import { deleteEquipment, saveEquipment } from "../catalogue/actions";

export const metadata = { title: "Matériel" };

export default async function EquipmentPage() {
  await requireStaff();
  const items = await db.equipment.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { bookings: { where: { dossier: { status: { in: ["OPTION", "CONFIRME"] }, eventStart: { gte: startOfDay() } } }, include: { dossier: { select: { id: true, reference: true, title: true, eventStart: true } } } } },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Parc matériel" subtitle="Inventaire et réservations : un avertissement apparaît sur la prestation si le stock ne suffit pas le même jour." />
      <form action={saveEquipment.bind(null, null)} className="card grid gap-2 p-5 sm:grid-cols-[1fr_170px_90px_1fr_auto]">
        <input name="name" required placeholder="Ex. Enceinte 15&quot; 1200 W" className="input" />
        <select name="category" className="input">{EQUIPMENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <input name="quantity" type="number" min={0} defaultValue={1} className="input" />
        <input name="notes" placeholder="Notes (n° de série, état…)" className="input" />
        <button className="btn-primary">Ajouter</button>
      </form>
      {EQUIPMENT_CATEGORIES.map((cat) => {
        const list = items.filter((i) => i.category === cat.id);
        if (!list.length) return null;
        return (
          <section key={cat.id} className="card">
            <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">{cat.label}</h2>
            <ul className="divide-y divide-slate-100">
              {list.map((i) => (
                <li key={i.id} className="px-5 py-3">
                  <form action={saveEquipment.bind(null, i.id)} className="grid items-center gap-2 sm:grid-cols-[1fr_170px_80px_1fr_auto_auto]">
                    <input name="name" defaultValue={i.name} className="input" />
                    <select name="category" defaultValue={i.category} className="input">{EQUIPMENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                    <input name="quantity" type="number" min={0} defaultValue={i.quantity} className="input" />
                    <input name="notes" defaultValue={i.notes ?? ""} className="input" />
                    <button className="btn-secondary py-1.5 text-xs">OK</button>
                    <button formAction={deleteEquipment.bind(null, i.id)} className="text-xs text-slate-400 hover:text-rose-600">✕</button>
                  </form>
                  {i.bookings.length > 0 && (
                    <div className="mt-1 text-xs text-slate-500">Réservé : {i.bookings.map((b) => <Link key={b.dossierId} href={`/prestations/${b.dossier.id}`} className="mr-2 hover:text-link-600">{b.quantity}× le {date(b.dossier.eventStart)} ({b.dossier.reference})</Link>)}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
