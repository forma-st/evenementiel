import { createHmac, randomBytes, createHash } from "crypto";

/** Double authentification TOTP (RFC 6238), compatible Google Authenticator, Microsoft Authenticator, 1Password… */
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHA[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHA[(value << (5 - bits)) & 31];
  return out;
}

function unbase32(s: string) {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = ALPHA.indexOf(c);
    if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32(randomBytes(20));

function hotp(secret: string, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/** Vérifie un code à 6 chiffres (tolérance d'une période de 30 s avant/après). */
export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const t = Math.floor(now / 30000);
  return [-1, 0, 1].some((d) => hotp(secret, t + d) === c);
}

export function otpauthUrl(secret: string, account: string, issuer: string) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Codes de secours (affichés une seule fois, stockés en empreinte). */
export function newRecoveryCodes() {
  const codes = Array.from({ length: 8 }, () => randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})/, "$1-"));
  return { codes, hashes: codes.map(hashCode) };
}
export const hashCode = (c: string) => createHash("sha256").update(c.replace(/[\s-]/g, "").toUpperCase()).digest("hex");
