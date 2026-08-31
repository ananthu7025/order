import { db } from "@/lib/db";
import { telegramSessions, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  sendMessage,
  answerCallbackQuery,
  inlineKeyboard,
  replyKeyboard,
  removeKeyboard,
  type TelegramUpdate,
} from "./client";
import { createInboundLead } from "@/lib/leads/create-inbound-lead";
import { runLeadAgent, type ChatTurn } from "./agent";
import { parseSearchIntent } from "@/lib/search/intent";
import { searchProducts } from "@/lib/search/products";

/**
 * Fully conversational requirement flow, marketplace-wide from /start:
 *
 * 1. AWAITING_SEARCH — the buyer describes what they need in free text;
 *    each message is turned into a structured query (lib/search/intent.ts)
 *    and searched across every verified manufacturer's published catalog
 *    (lib/search/products.ts). Matches are shown as buttons (manufacturer +
 *    product); no matches yet just prompts for more detail and stays here.
 * 2. Picking a result sets manufacturerId + productId on the session and
 *    moves to AWAITING_AGENT, now scoped to that one manufacturer.
 * 3. AWAITING_AGENT — lib/telegram/agent.ts (a Groq tool-calling agent)
 *    asks whatever follow-up questions are needed to fill in
 *    quantity/specification/location/deadline/business name, in any order.
 * 4. AWAITING_PHONE — Telegram's native "share contact" button (a verified
 *    number beats a typed one, and it's the one step that doesn't benefit
 *    from being conversational).
 * 5. DONE — finalizes into a lead scoped to the picked manufacturer.
 */

const HISTORY_TURN_LIMIT = 20;
const RESULT_CALLBACK_PREFIX = "pick_result:";

async function getOrCreateSession(chatId: string, from?: { username?: string; first_name?: string }) {
  const [existing] = await db.select().from(telegramSessions).where(eq(telegramSessions.chatId, chatId));
  if (existing) return existing;

  const [created] = await db
    .insert(telegramSessions)
    .values({
      chatId,
      step: "AWAITING_SEARCH",
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

/**
 * One turn of the AWAITING_SEARCH step: parse what the buyer is asking for,
 * search across every manufacturer's catalog, and either show the matches
 * as pick buttons or ask a short clarifying follow-up if nothing matched
 * yet. History is kept the same way the per-manufacturer agent does, so
 * parseSearchIntent has the full conversation to work with.
 */
async function handleSearch(session: typeof telegramSessions.$inferSelect, chatId: string, text: string) {
  const history = session.history ?? [];
  const intent = await parseSearchIntent(text, history);
  const results = await searchProducts(intent);

  const updatedHistory: ChatTurn[] = [...history, { role: "user" as const, content: text }].slice(-HISTORY_TURN_LIMIT);

  if (results.length === 0) {
    const reply =
      "I couldn't find a match for that yet — could you tell me a bit more about what you're looking for (product type, or a delivery location)?";
    await db
      .update(telegramSessions)
      .set({ history: [...updatedHistory, { role: "assistant" as const, content: reply }].slice(-HISTORY_TURN_LIMIT), updatedAt: new Date() })
      .where(eq(telegramSessions.chatId, chatId));
    await sendMessage(chatId, reply);
    return;
  }

  const reply = `Found ${results.length} match${results.length > 1 ? "es" : ""} — pick one to continue:`;
  await db
    .update(telegramSessions)
    .set({ history: [...updatedHistory, { role: "assistant" as const, content: reply }].slice(-HISTORY_TURN_LIMIT), updatedAt: new Date() })
    .where(eq(telegramSessions.chatId, chatId));

  await sendMessage(chatId, reply, {
    reply_markup: inlineKeyboard(
      results.map((r) => [
        {
          text: `${r.manufacturerName} — ${r.productName}`,
          callback_data: `${RESULT_CALLBACK_PREFIX}${r.manufacturerId}:${r.productId}`,
        },
      ])
    ),
  });
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
      case "AWAITING_SEARCH": {
        if (!text) return;
        await handleSearch(session, chatId, text);
        return;
      }

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
    const data = update.callback_query.data;
    await answerCallbackQuery(update.callback_query.id);
    if (!chatId || !data) return;

    if (data.startsWith(RESULT_CALLBACK_PREFIX)) {
      const [manufacturerId, productId] = data.slice(RESULT_CALLBACK_PREFIX.length).split(":");
      if (!manufacturerId || !productId) return;

      await db
        .update(telegramSessions)
        .set({ manufacturerId, productId, step: "AWAITING_AGENT", updatedAt: new Date() })
        .where(eq(telegramSessions.chatId, chatId));

      const [product] = await db.select({ name: products.name }).from(products).where(eq(products.id, productId));
      await sendMessage(chatId, `Great choice — <b>${product?.name ?? "that product"}</b>. Tell me more about your requirement (quantity, specs, delivery location, deadline, business name).`);
      return;
    }
  }
}
