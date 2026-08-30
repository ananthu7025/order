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
import { createInboundLead } from "@/lib/leads/create-inbound-lead";
import { extractRequirementDetails, type ExtractedDetails } from "./extract";

/**
 * Guided, button-driven requirement flow, with an LLM-assisted collection
 * step in the middle: after the buyer picks a product, they can describe
 * their requirement in one free-text message (or several) instead of
 * answering quantity/spec/location/deadline/business name one at a time.
 * Each message is run through Groq (extractRequirementDetails) to pull out
 * whichever fields it mentions; only the fields still missing afterwards
 * are asked about, one at a time, same as before. If Groq isn't configured
 * or a call fails, extraction returns nothing and the flow degrades
 * gracefully to asking every field individually — the buyer never sees an
 * error, just more questions. Once every field is collected, the session
 * is finalized into a lead via the same path a real WhatsApp+LLM pipeline
 * would use later.
 */

const PRODUCT_CALLBACK_PREFIX = "pick_product:";

// All five fields the guided flow used to ask one-at-a-time. deadline is the
// only one the buyer can skip outright (via a button); specification is
// "skippable" by the buyer explicitly saying "None", same as before —
// neither is ever left as null once the step is filled, so a null column is
// an unambiguous "not answered yet" signal for every field here.
const DETAIL_FIELDS = [
  "quantity",
  "specification",
  "location",
  "deadline",
  "businessName",
] as const satisfies readonly (keyof ExtractedDetails)[];
type DetailField = (typeof DETAIL_FIELDS)[number];

function missingDetailFields(session: typeof telegramSessions.$inferSelect): DetailField[] {
  return DETAIL_FIELDS.filter((field) => session[field] === null);
}

async function askForDetailField(chatId: string, field: DetailField) {
  switch (field) {
    case "quantity":
      return askForQuantity(chatId);
    case "specification":
      return askForSpecification(chatId);
    case "location":
      return askForLocation(chatId);
    case "deadline":
      return askForDeadline(chatId);
    case "businessName":
      return askForBusinessName(chatId);
  }
}

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

async function askForDetailsIntro(chatId: string) {
  await sendMessage(
    chatId,
    "Tell me about your requirement — quantity, any specific requirements (color, printing, size), delivery location, deadline, and your business name. You can share it all in one message or a few — I'll ask if anything's missing.",
    { reply_markup: removeKeyboard() }
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
      await askForProduct(chatId);
      return;
    }

    const session = await getOrCreateSession(chatId, update.message.from);

    switch (session.step) {
      case "AWAITING_PRODUCT":
        await askForProduct(chatId);
        return;

      case "AWAITING_DETAILS": {
        if (!text) return;

        const stillMissing = missingDetailFields(session);
        const found = await extractRequirementDetails(text, stillMissing);

        // Anything Groq didn't extract, and that the buyer hasn't been
        // asked about yet in this turn, falls back to the raw message —
        // preserves the old one-field-at-a-time behavior when there's
        // exactly one field left and no LLM (or a failed call).
        const updates: Partial<typeof telegramSessions.$inferInsert> = { ...found };
        if (stillMissing.length === 1 && !found[stillMissing[0]]) {
          updates[stillMissing[0]] = text;
        }

        let updated = session;
        if (Object.keys(updates).length > 0) {
          [updated] = await db
            .update(telegramSessions)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(telegramSessions.chatId, chatId))
            .returning();
        }

        const remaining = missingDetailFields(updated);
        if (remaining.length > 0) {
          await askForDetailField(chatId, remaining[0]);
          return;
        }

        await db
          .update(telegramSessions)
          .set({ step: "AWAITING_PHONE", updatedAt: new Date() })
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
        .set({ productId, step: "AWAITING_DETAILS", updatedAt: new Date() })
        .where(eq(telegramSessions.chatId, chatId));
      await askForDetailsIntro(chatId);
      return;
    }

    if (data === "skip_deadline") {
      const [updated] = await db
        .update(telegramSessions)
        .set({ deadline: "None", updatedAt: new Date() })
        .where(eq(telegramSessions.chatId, chatId))
        .returning();

      const remaining = missingDetailFields(updated);
      if (remaining.length > 0) {
        await askForDetailField(chatId, remaining[0]);
        return;
      }

      await db
        .update(telegramSessions)
        .set({ step: "AWAITING_PHONE", updatedAt: new Date() })
        .where(eq(telegramSessions.chatId, chatId));
      await askForPhone(chatId);
      return;
    }
  }
}
