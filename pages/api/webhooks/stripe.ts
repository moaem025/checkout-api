// pages/api/webhooks/stripe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// 웹훅은 RAW BODY가 필요합니다.
export const config = { api: { bodyParser: false } } as const;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// --- Utils -------------------------------------------------------------------

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

type ResendResponse = { id?: string; error?: { message: string } };

/** 에러 메시지 안전 추출 */
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

// --- Resend (이메일 발송) ----------------------------------------------------

async function sendEmail(to: string, subject: string, html: string): Promise<ResendResponse> {
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

  const json = (await res.json()) as unknown as ResendResponse;
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Resend ${res.status}`);
  }
  return json;
}

// --- Handler -----------------------------------------------------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void>
