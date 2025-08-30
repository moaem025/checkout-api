import type { NextApiHandler } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type CreateBody = {
  priceId?: string;
  quantity?: number;
  mode?: "payment" | "subscription";
};

function setCors(res: Parameters<NextApiHandler>[1]) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // 필요시 Framer 도메인으로 제한
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const handler: NextApiHandler = async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    // body 안전 파싱
    let body: unknown = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const { priceId, quantity, mode } = (body || {}) as CreateBody;

    const siteUrl = process.env.PUBLIC_SITE_URL || `https://${req.headers.host ?? ""}`;
    const successPath = process.env.SUCCESS_PATH || "/result";
    const cancelPath  = process.env.CANCEL_PATH  || "/";

    const session = await stripe.checkout.sessions.create({
      mode: mode ?? "payment",
      payment_method_types: ["card"],
      line_items: [{
        price: priceId ?? (process.env.PRICE_ID as string),
        quantity: quantity ?? 1,
      }],
      // ✅ success/cancel 은 여기!
      success_url: `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}${cancelPath}`,
    });

    res.status(200).json({ url: session.url }); return;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    res.status(500).json({ error: message }); return;
  }
};

export default handler;
