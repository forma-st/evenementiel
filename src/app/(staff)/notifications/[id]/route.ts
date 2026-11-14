import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

/** Ouvre une notification : la marque comme lue puis redirige vers l'élément concerné. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.redirect(new URL("/login", req.url));
  const { id } = await params;
  const n = await db.notification.findFirst({ where: { id, userId: u.id } });
  if (!n) return NextResponse.redirect(new URL("/notifications", req.url));
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  return NextResponse.redirect(new URL(n.link || "/notifications", req.url));
}
