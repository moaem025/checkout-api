// pages/api/checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// apiVersion 명시는 제거
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // 필요시 Framer 도메인으로 제한
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  setCors(res);

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const sessionId =
      typeof req.query.session_id === "string" ? req.query.session_id : "";
    if (!sessionId) { res.status(400).json({ error: "Missing session_id" }); return; }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price"],
    });

    res.status(200).json({
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
          amount_total: li.amount_total,
          price_id: (li.price as Stripe.Price | null)?.id ?? null,
        })) ?? [],
    }); return;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    res.status(500).json({ error: message }); return;
  }
}
