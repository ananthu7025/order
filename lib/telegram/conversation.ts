import { db } from "@/lib/db";
import { telegramSessions, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  sendMessage,
  answerCallbackQuery,
  inlineKeyboard,
  replyKeyboard,
  removeKeyboard,
  type TelegramUpdate,
} from "./client";
import { getCurrentManufacturer } from "@/lib/manufacturer";

/**
 * Guided, button-driven requirement flow — no LLM. Each step asks exactly
 * one question; free-text answers are stored as-is (no parsing needed,
 * since the buyer is answering one specific question at a time, not
 * writing an open-ended message). Once every field is collected, the
 * session is finalized into a lead via the same POST /api/leads/inbound
 * endpoint a real WhatsApp+LLM pipeline would use later.
 */

const PRODUCT_CALLBACK_PREFIX = "pick_product:";

async function getOrCreateSession(chatId: string, from?: { username?: string; first_name?: string }) {
  const [existing] = await db.select().from(telegramSessions).where(eq(telegramSessions.chatId, chatId));
  if (existing) return existing;

  const [created] = await db
    .insert(telegramSessions)
    .values({
      chatId,
      step: "AWAITING_PRODUCT",
      telegramUsername: from?.username,
      telegramFirstName: from?.first_name,
    })
    .returning();
  return created;
}

async function resetSession(chatId: string) {
  await db.delete(telegramSessions).where(eq(telegramSessions.chatId, chatId));
}

async function askForProduct(chatId: string) {
  const manufacturer = await getCurrentManufacturer();
  const rows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(and(eq(products.manufacturerId, manufacturer.id), eq(products.status, "PUBLISHED")));

  if (rows.length === 0) {
    await sendMessage(chatId, "Sorry, there are no products available to request a quote for right now.");
    return;
  }

  await sendMessage(
    chatId,
    `Welcome to <b>${manufacturer.companyName}</b>! What product are you interested in?`,
    {
      reply_markup: inlineKeyboard(
        rows.map((p) => [{ text: p.name, callback_data: `${PRODUCT_CALLBACK_PREFIX}${p.id}` }])
      ),
    }
  );
}

async function askForQuantity(chatId: string) {
  await sendMessage(chatId, "How many units do you need? (e.g. 5000)", {
    reply_markup: removeKeyboard(),
  });
}

async function askForSpecification(chatId: string) {
  await sendMessage(
    chatId,
    "Any specific requirements? (color, printing, size, customization, etc.) Reply with details, or send \"None\" if not applicable."
  );
}

async function askForLocation(chatId: string) {
  await sendMessage(chatId, "Where should this be delivered? (city or full address)");
}

async function askForDeadline(chatId: string) {
  await sendMessage(chatId, "When do you need this by? Reply with a date, or tap Skip.", {
    reply_markup: inlineKeyboard([[{ text: "Skip", callback_data: "skip_deadline" }]]),
  });
}

async function askForBusinessName(chatId: string) {
  await sendMessage(chatId, "What is your business or company name?");
}

async function askForPhone(chatId: string) {
  await sendMessage(chatId, "Last step — share your phone number so the manufacturer can reach you.", {
    reply_markup: replyKeyboard([[{ text: "📱 Share my phone number", request_contact: true }]]),
  });
}

/**
 * Called once all fields are collected (step DONE). Deliberately safe to
 * call more than once for the same session: the session row is only
 * deleted after the lead is confirmed created, so if the fetch to
 * /api/leads/inbound fails (network blip, dev server restart, etc.) the
 * session survives in DONE and the next message from the buyer just
 * retries this function instead of losing their answers.
 */
async function finalizeLead(session: typeof telegramSessions.$inferSelect) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const [product] = session.productId
    ? await db.select({ name: products.name }).from(products).where(eq(products.id, session.productId))
    : [];

  let res: Response;
  try {
    res = await fetch(`${appUrl}/api/leads/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "TELEGRAM",
        fromPhone: session.phone,
        telegramChatId: session.chatId,
        businessName: session.businessName,
        buyerName: session.telegramFirstName,
        productText: product?.name,
        matchedProductId: session.productId ?? undefined,
        quantity: session.quantity,
        specification: session.specification,
        location: session.location,
        deadline: session.deadline ?? undefined,
      }),
    });
  } catch (err) {
    console.error("finalizeLead: network error calling /api/leads/inbound", err);
    await sendMessage(
      session.chatId,
      "Couldn't reach the server just now. Your answers are saved — send anything to try again.",
      { reply_markup: removeKeyboard() }
    );
    return;
  }

  if (!res.ok) {
    console.error("finalizeLead: /api/leads/inbound returned", res.status, await res.text());
    await sendMessage(
      session.chatId,
      "Something went wrong saving your request. Your answers are saved — send anything to try again.",
      { reply_markup: removeKeyboard() }
    );
    return;
  }

  const body = await res.json();

  await sendMessage(
    session.chatId,
    body.autoQuote?.generated
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
      await askForProduct(chatId);
      return;
    }

    const session = await getOrCreateSession(chatId, update.message.from);

    switch (session.step) {
      case "AWAITING_PRODUCT":
        await askForProduct(chatId);
        return;

      case "AWAITING_QUANTITY": {
        if (!text) return;
        await db
          .update(telegramSessions)
          .set({ quantity: text, step: "AWAITING_SPECIFICATION", updatedAt: new Date() })
          .where(eq(telegramSessions.chatId, chatId));
        await askForSpecification(chatId);
        return;
      }

      case "AWAITING_SPECIFICATION": {
        if (!text) return;
        await db
          .update(telegramSessions)
          .set({ specification: text, step: "AWAITING_LOCATION", updatedAt: new Date() })
          .where(eq(telegramSessions.chatId, chatId));
        await askForLocation(chatId);
        return;
      }

      case "AWAITING_LOCATION": {
        if (!text) return;
        await db
          .update(telegramSessions)
          .set({ location: text, step: "AWAITING_DEADLINE", updatedAt: new Date() })
          .where(eq(telegramSessions.chatId, chatId));
        await askForDeadline(chatId);
        return;
      }

      case "AWAITING_DEADLINE": {
        if (!text) return;
        await db
          .update(telegramSessions)
          .set({ deadline: text, step: "AWAITING_BUSINESS_NAME", updatedAt: new Date() })
          .where(eq(telegramSessions.chatId, chatId));
        await askForBusinessName(chatId);
        return;
      }

      case "AWAITING_BUSINESS_NAME": {
        if (!text) return;
        await db
          .update(telegramSessions)
          .set({ businessName: text, step: "AWAITING_PHONE", updatedAt: new Date() })
          .where(eq(telegramSessions.chatId, chatId));
        await askForPhone(chatId);
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
        await sendMessage(chatId, "Send /start to submit a new requirement.");
        return;
    }
  }

  if (update.callback_query) {
    const chatId = String(update.callback_query.message?.chat.id);
    const data = update.callback_query.data;
    await answerCallbackQuery(update.callback_query.id);

    if (!chatId || !data) return;

    if (data.startsWith(PRODUCT_CALLBACK_PREFIX)) {
      const productId = data.slice(PRODUCT_CALLBACK_PREFIX.length);
      await db
        .update(telegramSessions)
        .set({ productId, step: "AWAITING_QUANTITY", updatedAt: new Date() })
        .where(eq(telegramSessions.chatId, chatId));
      await askForQuantity(chatId);
      return;
    }

    if (data === "skip_deadline") {
      await db
        .update(telegramSessions)
        .set({ deadline: null, step: "AWAITING_BUSINESS_NAME", updatedAt: new Date() })
        .where(eq(telegramSessions.chatId, chatId));
      await askForBusinessName(chatId);
      return;
    }
  }
}
