import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createCheckout, isStripeConfigured } from "@/lib/stripe";
import { baseUrl } from "@/lib/merge";
import { rateLimit, requestInfo } from "@/lib/security";

/** Ouvre la page de paiement sécurisée de Stripe pour une échéance. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const back = `${baseUrl()}/p/${token}`;
  if (!isStripeConfigured() || token.length < 20) return NextResponse.redirect(back, 303);
  const lim = await rateLimit(`pay:${(await requestInfo()).ip}`, 20, 15 * 60e3);
  if (!lim.ok) return NextResponse.redirect(`${back}?statut=attente`, 303);
  const p = await db.payment.findFirst({ where: { token }, include: { dossier: { include: { client: true } } } });
  if (!p || p.paidAt || p.amount <= 0) return NextResponse.redirect(back, 303);
  try {
    const s = await createCheckout({
      amount: p.amount, name: `${p.label} — ${p.dossier?.title ?? "Prestation"}`, description: p.dossier ? `Référence ${p.dossier.reference}` : "Règlement",
      email: p.dossier?.client.email, paymentId: p.id, successUrl: `${back}?statut=ok`, cancelUrl: `${back}?statut=annule`,
    });
    await db.payment.update({ where: { id: p.id }, data: { stripeSessionId: s.id } });
    return NextResponse.redirect(s.url, 303);
  } catch (e) {
    console.error("Stripe :", e);
    return NextResponse.redirect(`${back}?statut=erreur`, 303);
  }
}
