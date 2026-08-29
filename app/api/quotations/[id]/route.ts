import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { quotations, quotationLineItems, leads } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError } from "@/lib/api-helpers";
import { and, asc, eq } from "drizzle-orm";
import { sendQuotationPdfToBuyer } from "@/lib/pdf/send-quotation";

const updateQuotationSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REVISION_REQUESTED", "DECLINED"]).optional(),
  paymentTerms: z.string().optional(),
  leadTime: z.string().optional(),
  validTill: z.string().optional(),
  notes: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();

    const [quotation] = await db
      .select()
      .from(quotations)
      .where(and(eq(quotations.id, id), eq(quotations.manufacturerId, manufacturer.id)));

    if (!quotation) return jsonError("Quotation not found", 404);

    const lineItems = await db
      .select()
      .from(quotationLineItems)
      .where(eq(quotationLineItems.quotationId, id))
      .orderBy(asc(quotationLineItems.sortOrder));

    return NextResponse.json({ quotation: { ...quotation, lineItems } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Handles status transitions (Send / Accept / Request Revision / Decline)
// as well as editing terms before sending. Accepting a quotation moves the
// linked lead to WON, mirroring the CRM lifecycle in the UI.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = updateQuotationSchema.parse(body);

    const [existing] = await db
      .select()
      .from(quotations)
      .where(and(eq(quotations.id, id), eq(quotations.manufacturerId, manufacturer.id)));

    if (!existing) return jsonError("Quotation not found", 404);

    const [quotation] = await db
      .update(quotations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();

    if (data.status === "ACCEPTED") {
      await db
        .update(leads)
        .set({ status: "WON", updatedAt: new Date() })
        .where(eq(leads.id, existing.leadId));
    } else if (data.status === "DECLINED") {
      await db
        .update(leads)
        .set({ status: "LOST", updatedAt: new Date() })
        .where(eq(leads.id, existing.leadId));
    }

    // Deliver the quotation PDF the moment it's sent — deterministic,
    // template-based (see lib/pdf), no LLM involved. Best-effort: a
    // delivery failure shouldn't roll back the status change the
    // manufacturer just made.
    let pdfDelivery: { sent: boolean; reason?: string } | undefined;
    if (data.status === "SENT") {
      try {
        pdfDelivery = await sendQuotationPdfToBuyer(quotation.id);
      } catch (err) {
        console.error("Failed to send quotation PDF to buyer", err);
        pdfDelivery = { sent: false, reason: "Delivery failed" };
      }
    }

    return NextResponse.json({ quotation, pdfDelivery });
  } catch (err) {
    return handleApiError(err);
  }
}
