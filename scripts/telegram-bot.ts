import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
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
