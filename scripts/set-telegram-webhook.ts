import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Registers (or clears) the Telegram webhook. Run this once after deploying
 * to Vercel (or any host) so Telegram starts pushing updates to
 * POST /api/telegram/webhook instead of you having to run the long-polling
 * script (which can't run on serverless hosts at all).
 *
 * Usage:
 *   npx tsx scripts/set-telegram-webhook.ts <deployed-app-url>
 *   npx tsx scripts/set-telegram-webhook.ts --clear   (switch back to local polling)
 */
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set. Add it to .env.local.");
  }

  const arg = process.argv[2];

  if (arg === "--clear") {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
    const data = await res.json();
    console.log("deleteWebhook:", data);
    return;
  }

  if (!arg) {
    throw new Error(
      "Pass the deployed app URL, e.g.\n  npx tsx scripts/set-telegram-webhook.ts https://order-lovat-beta.vercel.app"
    );
  }

  const webhookUrl = `${arg.replace(/\/$/, "")}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
    }),
  });
  const data = await res.json();
  console.log("setWebhook:", data);

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
  console.log("getWebhookInfo:", info);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
