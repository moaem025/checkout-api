// pages/api/create-checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS (프리뷰/실도메인 허용)
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin as string);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { priceId, mode = "subscription", siteOrigin } = req.body;

    const success = `${siteOrigin}/result?access=ok&session_id={CHECKOUT_SESSION_ID}`;
    const cancel  = `${siteOrigin}/paywall?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode, // "payment" | "subscription"
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
