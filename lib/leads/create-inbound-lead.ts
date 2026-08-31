import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getManufacturerForBot } from "@/lib/manufacturer";
import { autoQuoteFromLead } from "@/lib/pdf/auto-quote";

export type InboundLeadInput = {
  source: "WHATSAPP" | "TELEGRAM" | "WEBSITE" | "MANUAL";
  fromPhone?: string;
  rawMessage?: string;
  telegramChatId?: string;
  buyerName?: string;
  businessName?: string;
  productText?: string;
  matchedProductId?: string;
  quantity?: string;
  specification?: string;
  location?: string;
  deadline?: string;
  notes?: string;
};

/**
 * Single entry point for every new lead, regardless of where it comes from —
 * shared by POST /api/leads/inbound (the HTTP boundary, used by anything
 * external: a future WhatsApp webhook, manual entry from the dashboard UI)
 * and lib/telegram/conversation.ts (which calls this directly rather than
 * looping back through its own HTTP API, since it already runs inside the
 * same deployment).
 */
export async function createInboundLead(data: InboundLeadInput) {
  const manufacturer = await getManufacturerForBot();

  const [lead] = await db
    .insert(leads)
    .values({
      manufacturerId: manufacturer.id,
      source: data.source,
      status: "NEW",
      fromPhone: data.fromPhone,
      rawMessage: data.rawMessage,
      telegramChatId: data.telegramChatId,
      buyerName: data.buyerName,
      businessName: data.businessName,
      productText: data.productText,
      matchedProductId: data.matchedProductId,
      quantity: data.quantity,
      specification: data.specification,
      location: data.location,
      deadline: data.deadline,
      notes: data.notes,
    })
    .returning();

  // Fully automatic quotation: the moment a Telegram lead has a matched
  // product and a parseable quantity, generate a quotation off the
  // product's own listed price and terms, and deliver the PDF — no
  // manufacturer click, no LLM. Best-effort: a failure here (e.g. the
  // product has no price set) must not fail lead creation itself.
  let autoQuote: Awaited<ReturnType<typeof autoQuoteFromLead>> | undefined;
  if (data.source === "TELEGRAM" && lead.matchedProductId) {
    try {
      autoQuote = await autoQuoteFromLead(lead.id);
    } catch (err) {
      console.error("autoQuoteFromLead failed", err);
    }
  }

  return { lead, autoQuote };
}
