import { createHmac, randomBytes } from "crypto";
import { db } from "./db";
import { safeEqual } from "./security";

/**
 * Paiement en ligne par Stripe Checkout (carte bancaire, Apple Pay, Google Pay…).
 * STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET dans Vercel. Sans clé, la page de paiement
 * affiche seulement les coordonnées de virement.
 */
export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

/** Lien de paiement d'une échéance (créé à la première demande). */
export async function paymentToken(paymentId: string) {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { token: true } });
  if (p.token) return p.token;
  const token = randomBytes(18).toString("base64url");
  await db.payment.update({ where: { id: paymentId }, data: { token } });
  return token;
}

function form(obj: Record<string, string | number>) {
  return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
}

export async function createCheckout(p: { amount: number; name: string; description: string; email?: string | null; paymentId: string; successUrl: string; cancelUrl: string }) {
  const body: Record<string, string | number> = {
    mode: "payment",
    locale: "fr",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": Math.round(p.amount * 100),
    "line_items[0][price_data][product_data][name]": p.name.slice(0, 250),
    "line_items[0][price_data][product_data][description]": p.description.slice(0, 500),
    client_reference_id: p.paymentId,
    "metadata[paymentId]": p.paymentId,
    "payment_intent_data[metadata][paymentId]": p.paymentId,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
  };
  if (p.email) body.customer_email = p.email;
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `${p.paymentId}-${Math.floor(Date.now() / 60000)}` },
    body: form(body),
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.url || !data.id) throw new Error(data.error?.message ?? `Stripe ${res.status}`);
  return { id: data.id, url: data.url };
}

/** Vérifie la signature d'un appel de Stripe (en-tête Stripe-Signature, tolérance de 5 minutes). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((x) => x.split("=") as [string, string]).filter((x) => x.length === 2));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return header.split(",").some((x) => x.startsWith("v1=") && safeEqual(x.slice(3), expected));
}
