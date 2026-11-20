import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { ensurePlanToken } from "@/lib/plan";

/** Ancien lien « Ma musique » : renvoie vers l'espace organisation. */
export default async function ClientMusic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireClient();
  const d = await db.dossier.findFirst({ where: { id, clientId: u.clientId, eventType: { notIn: ["LOCATION", "PRET"] } }, select: { id: true } });
  if (!d) notFound();
  redirect(`/e/${await ensurePlanToken(d.id)}`);
}
