// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs"; // Stripe SDK는 Node 런타임 필요

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : "Unknown error";
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    return new NextResponse("Missing signature or secret", { status: 400 });
  }

  // App Router에서는 원문을 직접 읽을 수 있음 (config 불필요)
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    // constructEvent는 Buffer를 받으니 변환
    event = stripe.webhooks.constructEvent(Buffer.from(raw), sig, whSecret);
  } catch (e) {
    return new NextResponse(`Webhook Error: ${errMsg(e)}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email || "";
      const amount = session.amount_total ?? undefined;
      const currency = (session.currency || "usd").toUpperCase();

      // --- Resend로 영수증/웰컴 메일 보내기 (옵션) ---
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const FROM_EMAIL = process.env.FROM_EMAIL; // 예: "SpeakPal <noreply@speakpal.app>"
      if (RESEND_API_KEY && FROM_EMAIL && email) {
        const fmt = (v?: number) =>
          typeof v === "number"
            ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v / 100)
            : "-";

        const html = `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height:1.6; color:#0f172a">
            <h2 style="margin:0 0 8px">결제가 완료되었습니다 🎉</h2>
            <p style="margin:0 0 12px">구매해 주셔서 감사합니다. 아래는 결제 요약입니다.</p>
            <ul style="margin:0 0 12px 18px; padding:0">
              <li>금액: <strong>${fmt(amount)}</strong></li>
              <li>통화: <strong>${currency}</strong></li>
              <li>세션 ID: <code>${session.id}</code></li>
            </ul>
            <p style="margin:12px 0 0">
              결과 페이지에서 맞춤 플랜을 확인하세요:<br/>
              <a href="${process.env.PUBLIC_SITE_URL}/result?session_id=${session.id}&access=ok" target="_blank" rel="noopener">
                결과 페이지 열기
              </a>
            </p>
          </div>
        `;

        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: email,
            subject: "결제가 완료되었습니다",
            html,
          }),
        });

        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          console.error("Resend error", j);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    return new NextResponse(`Handler Error: ${errMsg(e)}`, { status: 500 });
  }
}
