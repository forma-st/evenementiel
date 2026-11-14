import { createHmac, randomBytes } from "crypto";
import { cookies } from "next/headers";

export const GALLERY_STATUSES: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  PUBLIEE: { label: "En ligne", color: "bg-emerald-100 text-emerald-700" },
  ARCHIVEE: { label: "Archivée", color: "bg-zinc-200 text-zinc-600" },
};

export const galleryToken = () => randomBytes(12).toString("base64url");
/** Code d'accès lisible (sans 0/O ni 1/I). */
export const accessCode = () => Array.from(randomBytes(6), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");

const sign = (v: string) => createHmac("sha256", process.env.SESSION_SECRET || "dev-secret").update(v).digest("base64url").slice(0, 32);
const cookieName = (id: string) => `gal_${id}`;

/** Le visiteur a-t-il saisi le bon code pour cette galerie ? */
export async function hasGalleryAccess(g: { id: string; password: string | null }) {
  if (!g.password) return true;
  return (await cookies()).get(cookieName(g.id))?.value === sign(`${g.id}:${g.password}`);
}

export async function grantGalleryAccess(g: { id: string; password: string | null }) {
  (await cookies()).set(cookieName(g.id), sign(`${g.id}:${g.password ?? ""}`), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
}

export const isImage = (mime: string) => mime.startsWith("image/");
export const isVideo = (mime: string) => mime.startsWith("video/");

export function fileSize(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1).replace(".", ",")} Mo`;
  return `${(n / 1024 ** 3).toFixed(2).replace(".", ",")} Go`;
}

/** La galerie est-elle consultable publiquement ? */
export const isGalleryOpen = (g: { status: string; expiresAt: Date | null }) => g.status === "PUBLIEE" && (!g.expiresAt || g.expiresAt > new Date());
