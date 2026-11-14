import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { randomBytes } from "crypto";

/**
 * Stockage des photos et fichiers.
 * - Vercel Blob (BLOB_READ_WRITE_TOKEN) : envoi direct depuis le navigateur, sans limite de taille côté serveur. Recommandé en production.
 * - Sinon : disque local (dossier STORAGE_DIR, par défaut ./storage) — pour un serveur classique ou les essais en local.
 */
export const isBlobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const ROOT = () => path.resolve(process.env.STORAGE_DIR || "storage");
const LOCAL_PREFIX = "/api/fichiers/";

export const safeName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "-").slice(-120) || "fichier";

export async function saveLocal(folder: string, name: string, bytes: Uint8Array) {
  const rel = path.posix.join(folder.replace(/[^\w-]/g, ""), `${randomBytes(9).toString("base64url")}-${safeName(name)}`);
  const full = path.join(ROOT(), rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return LOCAL_PREFIX + rel;
}

/** Chemin disque d'une URL locale (refuse toute sortie du dossier de stockage). */
export function localPath(url: string) {
  if (!url.startsWith(LOCAL_PREFIX)) return null;
  const full = path.resolve(ROOT(), decodeURIComponent(url.slice(LOCAL_PREFIX.length)));
  return full.startsWith(ROOT() + path.sep) ? full : null;
}

export async function readLocal(url: string) {
  const p = localPath(url);
  return p ? readFile(p) : null;
}

/** Flux de lecture d'un fichier (local ou Blob). */
export async function openStream(url: string): Promise<ReadableStream<Uint8Array> | null> {
  const p = localPath(url);
  if (p) return Readable.toWeb(createReadStream(p)) as ReadableStream<Uint8Array>;
  if (/^https:\/\/[\w.-]+\.blob\.vercel-storage\.com\//.test(url)) {
    const r = await fetch(url);
    return r.ok ? r.body : null;
  }
  return null;
}

export async function deleteStored(urls: (string | null | undefined)[]) {
  const list = urls.filter((u): u is string => !!u);
  const blobs = list.filter((u) => u.includes(".blob.vercel-storage.com/"));
  if (blobs.length && isBlobConfigured()) {
    const { del } = await import("@vercel/blob");
    for (let i = 0; i < blobs.length; i += 500) await del(blobs.slice(i, i + 500)).catch((e) => console.error("Suppression Blob :", e));
  }
  for (const u of list) {
    const p = localPath(u);
    if (p) await unlink(p).catch(() => {});
  }
}
