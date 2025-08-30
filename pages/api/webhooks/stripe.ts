// pages/api/webhooks/stripe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// ✨ 웹훅은 RAW BODY가 필요합니다.
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// 간단한 raw body 추출 유틸 (추가 패키지 없이 동작)
async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// --- Resend (이메일 발송) ---
type ResendResponse = { id?: string; error?: { message: string } };
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL; // 예: "SpeakPal <noreply@speakpal.app>"
  if (!apiKey || !from) throw new Error("RESEND_API_KEY 또는 FROM_EMAIL 누락");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  const json = (await res.json()) as ResendResponse;
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Resend ${res.status}`);
  }
  return json;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const sig = req.headers["stripe-signature"] as string | undefined;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) { res.status(400).send("Missing signature or secret"); return; }

  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`); return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const email = session.customer_details?.email || "";
      const amount = session.amount_total;
      const currency = session.currency || "usd";

      // 메타데이터(퀴즈/UTM)를 보냈었다면 여기서 사용 가능
      // const meta = session.metadata || {};

      if (email) {
        const fmt = (v?: number) =>
          typeof v === "number"
            ? new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase() }).format(v / 100)
            : "-";

        const html = `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height:1.6; color:#0f172a">
            <h2 style="margin:0 0 8px">결제가 완료되었습니다 🎉</h2>
            <p style="margin:0 0 12px">구매해 주셔서 감사합니다. 아래는 결제 요약입니다.</p>
            <ul style="margin:0 0 12px 18px; padding:0">
              <li>금액: <strong>${fmt(amount)}</strong></li>
              <li>통화: <strong>${(currency || "usd").toUpperCase()}</strong></li>
              <li>세션 ID: <code>${session.id}</code></li>
            </ul>
            <p style="margin:12px 0 0">
              결과 페이지에서 맞춤 플랜을 확인하세요:<br/>
              <a href="${process.env.PUBLIC_SITE_URL}/result?session_id=${session.id}&access=ok" target="_blank">
                결과 페이지 열기
              </a>
            </p>
          </div>`;

        await sendEmail(email, "결제가 완료되었습니다", html);
      }
    }

    // 다른 이벤트도 필요하면 추가 처리 가능
    res.status(200).json({ received: true }); return;
  } catch (err: any) {
    res.status(500).send(`Handler Error: ${err.message}`); return;
  }
}
