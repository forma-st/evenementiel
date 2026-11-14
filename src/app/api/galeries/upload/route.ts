import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Jeton d'envoi direct navigateur -> Vercel Blob (réservé à l'équipe). */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const res = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await currentUser();
        if (!user || user.role === "CLIENT") throw new Error("Non autorisé");
        const galleryId = String(clientPayload ?? "");
        if (!galleryId || !(await db.gallery.count({ where: { id: galleryId } })) || !pathname.startsWith(`galeries/${galleryId}/`)) throw new Error("Galerie inconnue");
        return { addRandomSuffix: true, maximumSizeInBytes: 5 * 1024 ** 3, tokenPayload: galleryId };
      },
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
