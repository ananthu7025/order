import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Long-polling bot for LOCAL DEV ONLY. Telegram delivers updates either via
 * webhook or via getUpdates, never both — if a webhook is registered (e.g.
 * pointed at a Vercel deployment via scripts/set-telegram-webhook.ts),
 * getUpdates always returns empty and this script silently does nothing.
 * Run `npm run telegram:webhook:clear` first if you switched from webhook
 * mode back to local polling.
 */
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set. Add it to .env.local.");
  }

  const webhookInfo = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
  if (webhookInfo.result?.url) {
    console.error(
      `A webhook is currently registered at ${webhookInfo.result.url} — long polling will receive nothing until it's cleared.\n` +
        `Run: npm run telegram:webhook:clear`
    );
    process.exit(1);
  }

  const { getUpdates } = await import("../lib/telegram/client");
  const { handleUpdate } = await import("../lib/telegram/conversation");

  console.log("Telegram bot started (long polling). Press Ctrl+C to stop.");

  let offset = 0;

  // Long polling loop: each getUpdates call blocks on Telegram's side for up
  // to 30s waiting for new messages, so this isn't a busy-loop.
  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handleUpdate(update);
        } catch (err) {
          console.error("Error handling update", update.update_id, err);
        }
      }
    } catch (err) {
      console.error("Error polling Telegram, retrying in 3s...", err);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

main();
