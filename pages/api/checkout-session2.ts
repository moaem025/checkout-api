// pages/api/create-checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// apiVersion는 명시하지 않음(버전 불일치 에러 방지)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type CreateBody = {
  priceId?: string;
  quantity?: number;
  mode?: "payment" | "subscription";
};

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // body 안전 파싱
    let body: unknown = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const { priceId, quantity, mode } = (body || {}) as CreateBody;

    const siteUrl =
      process.env.PUBLIC_SITE_URL || `https://${req.headers.host ?? ""}`;
    const successPath = process.env.SUCCESS_PATH || "/result";
    const cancelPath = process.env.CANCEL_PATH || "/";

    const session = await stripe.checkout.sessions.create({
      mode: mode ?? "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId ?? (process.env.PRICE_ID as string),
          quantity: quantity ?? 1,
        },
      ],
      // ✅ 여기가 success/cancel URL이 들어가는 자리
      success_url: `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${cancelPath}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    return res.status(500).json({ error: message });
  }
}
