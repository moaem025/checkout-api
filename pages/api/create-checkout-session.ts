// pages/api/create-checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// ✅ apiVersion 옵션 제거 (두 번째 인자 통째로 삭제)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const origin = req.headers.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST")   { res.status(405).end(); return; }

  try {
    const { priceId, mode = "subscription", siteOrigin } = req.body as {
      priceId: string; mode?: "payment" | "subscription"; siteOrigin: string;
    };
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteOrigin}/result?access=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/paywall?canceled=1`,
      allow_promotion_codes: true,
    });
    res.status(200).json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: msg });
  }
}
