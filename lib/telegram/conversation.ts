import { db } from "@/lib/db";
import { telegramSessions, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  sendMessage,
  answerCallbackQuery,
  replyKeyboard,
  removeKeyboard,
  type TelegramUpdate,
} from "./client";
import { createInboundLead } from "@/lib/leads/create-inbound-lead";
import { runLeadAgent, type ChatTurn } from "./agent";

/**
 * Fully conversational requirement flow. From /start onward the buyer just
 * chats naturally — "hi, looking for packaging for my cafe" — and
 * lib/telegram/agent.ts (a Groq tool-calling agent) asks whatever follow-up
 * questions are needed, matching their answers against the live product
 * catalog and filling in quantity/specification/location/deadline/business
 * name as they come up in conversation, in any order. No buttons until the
 * very end, where Telegram's native "share contact" button is kept for the
 * phone number (a verified number beats a typed one, and it's the one step
 * that doesn't benefit from being conversational). Once the agent signals
 * it has everything, the session moves to AWAITING_PHONE and finalizes into
 * a lead exactly as before.
 */

const HISTORY_TURN_LIMIT = 20;

async function getOrCreateSession(chatId: string, from?: { username?: string; first_name?: string }) {
  const [existing] = await db.select().from(telegramSessions).where(eq(telegramSessions.chatId, chatId));
  if (existing) return existing;

  const [created] = await db
    .insert(telegramSessions)
    .values({
      chatId,
      step: "AWAITING_AGENT",
      telegramUsername: from?.username,
      telegramFirstName: from?.first_name,
    })
    .returning();
  return created;
}

async function resetSession(chatId: string) {
  await db.delete(telegramSessions).where(eq(telegramSessions.chatId, chatId));
}

async function greet(chatId: string) {
  await sendMessage(
    chatId,
    "Hi! 👋 We're OrderPlatform. What are you looking to source today?",
    { reply_markup: removeKeyboard() }
  );
}

async function askForPhone(chatId: string) {
  await sendMessage(chatId, "Last step — share your phone number so the manufacturer can reach you.", {
    reply_markup: replyKeyboard([[{ text: "📱 Share my phone number", request_contact: true }]]),
  });
}

/**
 * Called once all fields are collected (step DONE). Deliberately safe to
 * call more than once for the same session: the session row is only
 * deleted after the lead is confirmed created, so if createInboundLead
 * throws (a transient DB error, etc.) the session survives in DONE and the
 * next message from the buyer just retries this function instead of
 * losing their answers.
 */
async function finalizeLead(session: typeof telegramSessions.$inferSelect) {
  const [product] = session.productId
    ? await db.select({ name: products.name }).from(products).where(eq(products.id, session.productId))
    : [];

  let result: Awaited<ReturnType<typeof createInboundLead>>;
  try {
    result = await createInboundLead({
      source: "TELEGRAM",
      fromPhone: session.phone ?? undefined,
      telegramChatId: session.chatId,
      businessName: session.businessName ?? undefined,
      buyerName: session.telegramFirstName ?? undefined,
      productText: product?.name,
      matchedProductId: session.productId ?? undefined,
      quantity: session.quantity ?? undefined,
      specification: session.specification ?? undefined,
      location: session.location ?? undefined,
      deadline: session.deadline ?? undefined,
    });
  } catch (err) {
    console.error("finalizeLead: createInboundLead failed", err);
    await sendMessage(
      session.chatId,
      "Something went wrong saving your request. Your answers are saved — send anything to try again.",
      { reply_markup: removeKeyboard() }
    );
    return;
  }

  await sendMessage(
    session.chatId,
    result.autoQuote?.generated
      ? `✅ Thank you! Your requirement for <b>${product?.name ?? "the product"}</b> has been received — your quotation is being prepared now.`
      : `✅ Thank you! Your requirement for <b>${product?.name ?? "the product"}</b> has been sent to the manufacturer. Your quotation will be delivered shortly.\n\nSend /start to submit another requirement.`,
    { reply_markup: removeKeyboard() }
  );

  await resetSession(session.chatId);
}

export async function handleUpdate(update: TelegramUpdate) {
  if (update.message) {
    const chatId = String(update.message.chat.id);
    const text = update.message.text?.trim();
    const contact = update.message.contact;

    if (text === "/start") {
      await resetSession(chatId);
      await getOrCreateSession(chatId, update.message.from);
      await greet(chatId);
      return;
    }

    const session = await getOrCreateSession(chatId, update.message.from);

    switch (session.step) {
      case "AWAITING_AGENT": {
        if (!text) return;

        const result = await runLeadAgent(session, text);

        const history: ChatTurn[] = [
          ...(session.history ?? []),
          { role: "user" as const, content: text },
          { role: "assistant" as const, content: result.reply },
        ].slice(-HISTORY_TURN_LIMIT);

        const [updated] = await db
          .update(telegramSessions)
          .set({
            ...result.fields,
            history,
            step: result.readyForPhone ? "AWAITING_PHONE" : "AWAITING_AGENT",
            updatedAt: new Date(),
          })
          .where(eq(telegramSessions.chatId, chatId))
          .returning();

        await sendMessage(chatId, result.reply);
        if (updated.step === "AWAITING_PHONE") {
          await askForPhone(chatId);
        }
        return;
      }

      case "AWAITING_PHONE": {
        const phone = contact?.phone_number ?? text;
        if (!phone) {
          await sendMessage(chatId, "Please tap the button to share your phone number.");
          return;
        }
        const [updated] = await db
          .update(telegramSessions)
          .set({ phone, step: "DONE", updatedAt: new Date() })
          .where(eq(telegramSessions.chatId, chatId))
          .returning();
        await finalizeLead(updated);
        return;
      }

      case "DONE":
        // finalizeLead previously failed to reach the API (network blip,
        // server restart) — the session survived so any new message just
        // retries it instead of silently losing everything the buyer typed.
        await finalizeLead(session);
        return;

      default:
        // Legacy steps from the old button-driven flow (AWAITING_PRODUCT,
        // AWAITING_QUANTITY, ..., AWAITING_DETAILS) — no longer produced for
        // new sessions, but a session created before this change could
        // still be sitting on one. Simplest safe resolution is to restart.
        await sendMessage(chatId, "Send /start to submit a new requirement.");
        return;
    }
  }

  if (update.callback_query) {
    const chatId = String(update.callback_query.message?.chat.id);
    await answerCallbackQuery(update.callback_query.id);
    if (!chatId) return;
  }
}
