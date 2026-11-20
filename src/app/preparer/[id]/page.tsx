import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { parsePrep, prepOutdated } from "@/lib/prep";
import { eventKind } from "@/lib/presta";
import { TZ } from "@/lib/format";
import { PrepMobile } from "@/components/PrepMobile";

export const metadata = { title: "Préparation" };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#102a5c" };

export default async function PrepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertDossierVisible(await requireStaff(), id);
  const d = await db.dossier.findUnique({ where: { id }, select: { id: true, title: true, reference: true, eventType: true, eventStart: true, venueName: true, venueCity: true, prepList: true, equipment: { select: { equipmentId: true, quantity: true } } } });
  if (!d) notFound();
  const list = parsePrep(d.prepList);
  return (
    <div className="mx-auto min-h-screen max-w-2xl">
      <header className="nav-navy px-4 pt-4 pb-5">
        <div className="flex items-center justify-between text-sm">
          <Link href="/preparer" className="opacity-80">← Toutes les préparations</Link>
          <Link href={`/prestations/${d.id}`} className="opacity-80">Fiche ↗</Link>
        </div>
        <div className="mt-3 text-sm opacity-80">{eventKind(d.eventType).icon} {d.reference}</div>
        <h1 className="text-xl font-semibold">{d.title}</h1>
        {d.eventStart && <div className="text-sm opacity-90 first-letter:uppercase">{new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d.eventStart)}{d.venueName || d.venueCity ? ` · ${d.venueName ?? d.venueCity}` : ""}</div>}
      </header>
      <PrepMobile dossierId={d.id} items={list?.items ?? []} hasList={!!list} hasEquipment={d.equipment.length > 0} outdated={prepOutdated(list, d.equipment)} />
    </div>
  );
}
