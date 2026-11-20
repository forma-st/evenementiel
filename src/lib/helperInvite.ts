import { db } from "./db";

/** Invitation d'un renfort extérieur à partir de son lien personnel. */
export async function loadInvite(token: string) {
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return null;
  return db.helperInvite.findFirst({ where: { token }, include: { helper: true, request: true } });
}
