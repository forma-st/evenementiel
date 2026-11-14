import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchCompanies } from "@/lib/sirene";

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role === "CLIENT") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ results: [] });
  try {
    const results = await searchCompanies(q);
    // signale les entreprises déjà présentes dans le CRM
    const existing = await db.client.findMany({
      where: { siren: { in: results.map((r) => r.siren) } },
      select: { id: true, siren: true },
    });
    const map = new Map(existing.map((e) => [e.siren, e.id]));
    return NextResponse.json({ results: results.map((r) => ({ ...r, existingId: map.get(r.siren) ?? null })) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
