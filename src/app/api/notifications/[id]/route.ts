import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

/** Marque une notification comme lue (id = "tout" pour toutes). */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  await db.notification.updateMany({ where: { userId: u.id, readAt: null, ...(id === "tout" ? {} : { id }) }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
