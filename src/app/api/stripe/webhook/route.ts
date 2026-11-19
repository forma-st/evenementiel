import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe";
import { markPaidOnline } from "@/lib/paymentReceived";

/** Notifications de Stripe (paiement terminé). Seuls les appels signés avec STRIPE_WEBHOOK_SECRET sont pris en compte. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Non configuré", { status: 503 });
  const payload = await req.text();
  if (payload.length > 1_000_000 || !verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return new NextResponse("Signature invalide", { status: 400 });
  const event = JSON.parse(payload) as { type: string; data: { object: { id: string; payment_status?: string; metadata?: { paymentId?: string }; client_reference_id?: string } } };
  const s = event.data.object;
  const paymentId = s.metadata?.paymentId ?? s.client_reference_id;
  if (paymentId && (event.type === "checkout.session.async_payment_succeeded" || (event.type === "checkout.session.completed" && s.payment_status === "paid"))) {
    await markPaidOnline(paymentId, s.id);
  }
  return NextResponse.json({ received: true });
}
