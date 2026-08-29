import { NextRequest, NextResponse } from "next/server";
import { handleUpdate } from "@/lib/telegram/conversation";
import type { TelegramUpdate } from "@/lib/telegram/client";

/**
 * Telegram pushes updates here instead of us polling for them — this is
 * what makes the bot work on Vercel (or any serverless host), where
 * scripts/telegram-bot.ts's long-polling loop can't run at all (no
 * persistent process). Registered once via setWebhook; see
 * scripts/set-telegram-webhook.ts.
 *
 * handleUpdate() itself is unchanged from the polling version — it never
 * knew or cared how the update arrived.
 */
export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();
    await handleUpdate(update);
  } catch (err) {
    // Telegram retries on non-2xx, which would resend the same update
    // forever if handling fails deterministically — log and still return
    // 200 so a single bad update doesn't loop.
    console.error("Telegram webhook error", err);
  }

  return NextResponse.json({ ok: true });
}
