import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";
import { createInboundLead } from "@/lib/leads/create-inbound-lead";

/**
 * HTTP entry point for a new lead, regardless of where it comes from.
 *
 * - A future WhatsApp webhook calls this the instant a message arrives, with
 *   just { source: "WHATSAPP", fromPhone, rawMessage }. The lead is created
 *   immediately with status=NEW and every structured field left null —
 *   nothing is lost even before the LLM extraction step runs.
 * - A future LLM step (or a human, for now) fills in the structured fields
 *   later via PATCH /api/leads/:id/extract.
 * - Manual entry from the "Add Lead Manually" button in the UI calls this
 *   same endpoint with source: "MANUAL" and the structured fields already
 *   filled in directly, since a human is typing them in — no separate
 *   extract step is required for that source.
 * - The Telegram bot (lib/telegram/conversation.ts) does NOT call this over
 *   HTTP — it calls createInboundLead() directly, since it already runs
 *   inside this same deployment. This route exists for external callers.
 */
const inboundLeadSchema = z.object({
  source: z.enum(["WHATSAPP", "TELEGRAM", "WEBSITE", "MANUAL"]),
  fromPhone: z.string().optional(),
  rawMessage: z.string().optional(),
  telegramChatId: z.string().optional(),

  // Optional structured fields — filled in immediately for manual entry,
  // left absent for a raw bot message awaiting extraction.
  buyerName: z.string().optional(),
  businessName: z.string().optional(),
  productText: z.string().optional(),
  matchedProductId: z.string().optional(),
  quantity: z.string().optional(),
  specification: z.string().optional(),
  location: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = inboundLeadSchema.parse(body);
    const { lead, autoQuote } = await createInboundLead(data);
    return NextResponse.json({ lead, autoQuote }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
