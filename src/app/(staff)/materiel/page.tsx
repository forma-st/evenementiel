import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { EQUIPMENT_CATEGORIES, eventKind } from "@/lib/presta";
import { startOfDay, addDays } from "@/lib/tasks";
import { HOLDING_STATUSES } from "@/lib/equipment";
import { EquipmentBoard, type BoardItem } from "@/components/EquipmentBoard";
import { deleteEquipment, saveEquipment } from "../catalogue/actions";

export const metadata = { title: "Matériel" };

const PERIODS = [[30, "30 jours"], [90, "3 mois"], [180, "6 mois"], [365, "1 an"]] as const;
const ICONS: Record<string, string> = { SONO: "🔊", DJ: "🎛", LUMIERE: "💡", PHOTO: "📷", STRUCTURE: "🏗", AUTRE: "📦" };

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const days = PERIODS.some(([n]) => String(n) === sp.jours) ? Number(sp.jours) : 90;
  const from = startOfDay();
  const items = await db.equipment.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      bookings: {
        where: { dossier: { status: { in: HOLDING_STATUSES }, eventEnd: { gte: from }, eventStart: { lt: addDays(from, days) } } },
        include: { dossier: { select: { id: true, reference: true, title: true, status: true, eventType: true, eventStart: true, eventEnd: true, venueCity: true, venueName: true, client: { select: { name: true } } } } },
      },
    },
  });
  const data: BoardItem[] = items.map((i) => ({
    id: i.id, name: i.name, category: i.category, quantity: i.quantity, outOfService: i.outOfService, notes: i.notes, dailyRate: i.dailyRate, replacementValue: i.replacementValue,
    bookings: i.bookings
      .map((b) => ({
        dossierId: b.dossier.id, reference: b.dossier.reference, title: b.dossier.title, status: b.dossier.status, icon: eventKind(b.dossier.eventType).icon,
        start: b.dossier.eventStart!.toISOString(), end: (b.dossier.eventEnd ?? b.dossier.eventStart!).toISOString(),
        city: b.dossier.venueCity, venue: b.dossier.venueName, client: b.dossier.client.name, quantity: b.quantity,
      }))
      .sort((a, b) => a.start.localeCompare(b.start)),
  }));
  return (
    <EquipmentBoard
      items={data}
      cats={EQUIPMENT_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: ICONS[c.id] ?? "📦" }))}
      days={days}
      periods={PERIODS}
      save={saveEquipment}
      remove={deleteEquipment}
    />
  );
}
