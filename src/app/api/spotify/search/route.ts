import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/security";
import { searchTracks, spotifyConfigured } from "@/lib/spotify";

/** Recherche de titres pour le planning musical (équipe et clients connectés). */
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!spotifyConfigured()) return NextResponse.json({ configured: false, items: [] });
  if (!(await rateLimit(`spotify:${u.id}`, 120, 6e4)).ok) return NextResponse.json({ items: [] }, { status: 429 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try { return NextResponse.json({ configured: true, items: await searchTracks(q) }); } catch { return NextResponse.json({ configured: true, items: [] }); }
}
