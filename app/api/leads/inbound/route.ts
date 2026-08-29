import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError } from "@/lib/api-helpers";

/**
 * Single entry point for every new lead, regardless of where it comes from.
 *
 * - A future WhatsApp bot calls this the instant a message arrives, with
 *   just { source: "WHATSAPP", fromPhone, rawMessage }. The lead is created
 *   immediately with status=NEW and every structured field left null —
 *   nothing is lost even before the LLM extraction step runs.
 * - A future LLM step (or a human, for now) fills in the structured fields
 *   later via PATCH /api/leads/:id/extract.
 * - Manual entry from the "Add Lead Manually" button in the UI calls this
 *   same endpoint with source: "MANUAL" and the structured fields already
 *   filled in directly, since a human is typing them in — no separate
 *   extract step is required for that source.
 */
const inboundLeadSchema = z.object({
  source: z.enum(["WHATSAPP", "WEBSITE", "MANUAL"]),
  fromPhone: z.string().optional(),
  rawMessage: z.string().optional(),

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
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = inboundLeadSchema.parse(body);

    const [lead] = await db
      .insert(leads)
      .values({
        manufacturerId: manufacturer.id,
        source: data.source,
        status: "NEW",
        fromPhone: data.fromPhone,
        rawMessage: data.rawMessage,
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

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
