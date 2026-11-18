import { NextResponse } from "next/server";
import { runScheduled } from "@/lib/automations";
import { purgeSecurityData, safeEqual } from "@/lib/security";

export const maxDuration = 300;

/** Vérification quotidienne des automatisations (appelée par Vercel Cron, voir vercel.json). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new NextResponse("Non autorisé", { status: 401 });
  if (!secret && process.env.NODE_ENV === "production") return new NextResponse("Définissez CRON_SECRET", { status: 500 });
  const r = await runScheduled();
  await purgeSecurityData();
  return NextResponse.json(r);
}
