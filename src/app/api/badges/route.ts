import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { badgesFor } from "@/lib/badges";

export async function GET() {
  const u = await currentUser();
  if (!u || u.role === "CLIENT") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await badgesFor(u.id));
}
