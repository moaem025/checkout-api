// pages/api/checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS (Framer에서 호출할 수 있게)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sessionId = req.query.session_id as string | undefined;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    // 세션 상세 조회 (line_items까지 함께 가져오기)
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price"],
    });

    // 그대로 전체를 반환해도 되고, 필요한 필드만 추려서 반환해도 됨
    return res.status(200).json({
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email ?? null,
      line_items:
        session.line_items?.data.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          amount_subtotal: li.amount_subtotal,
          price_id: (li.price as Stripe.Price | null)?.id ?? null,
        })) ?? [],
    });
 } catch (err: unknown) {                        // ← any 대신 unknown
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
