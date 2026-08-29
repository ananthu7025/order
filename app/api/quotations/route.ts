import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { quotations, quotationLineItems, leads } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError, generateNumber } from "@/lib/api-helpers";
import { desc, eq } from "drizzle-orm";

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.union([z.string(), z.number()]),
  rate: z.union([z.string(), z.number()]),
});

const createQuotationSchema = z.object({
  leadId: z.string().min(1),
  productId: z.string().optional(),
  gstPercent: z.union([z.string(), z.number()]).optional(),
  paymentTerms: z.string().optional(),
  leadTime: z.string().optional(),
  validTill: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
});

function computeTotals(items: { quantity: number; rate: number }[], gstPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const gstAmount = Math.round(subtotal * (gstPercent / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
  return { subtotal, gstAmount, totalAmount };
}

export async function GET() {
  try {
    const manufacturer = await getCurrentManufacturer();

    const rows = await db
      .select()
      .from(quotations)
      .where(eq(quotations.manufacturerId, manufacturer.id))
      .orderBy(desc(quotations.createdAt));

    return NextResponse.json({ quotations: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = createQuotationSchema.parse(body);

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, data.leadId));

    if (!lead || lead.manufacturerId !== manufacturer.id) {
      return jsonError("Lead not found", 404);
    }

    const gstPercent = data.gstPercent != null ? Number(data.gstPercent) : 18;
    const normalizedItems = data.lineItems.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
    }));
    const { subtotal, gstAmount, totalAmount } = computeTotals(normalizedItems, gstPercent);

    const [quotation] = await db
      .insert(quotations)
      .values({
        manufacturerId: manufacturer.id,
        leadId: data.leadId,
        productId: data.productId,
        quoteNumber: generateNumber("QT"),
        status: "DRAFT",
        subtotal: String(subtotal),
        gstPercent: String(gstPercent),
        gstAmount: String(gstAmount),
        totalAmount: String(totalAmount),
        paymentTerms: data.paymentTerms,
        leadTime: data.leadTime,
        validTill: data.validTill,
        notes: data.notes,
      })
      .returning();

    const insertedLineItems = await db
      .insert(quotationLineItems)
      .values(
        normalizedItems.map((item, index) => ({
          quotationId: quotation.id,
          description: item.description,
          quantity: String(item.quantity),
          rate: String(item.rate),
          amount: String(item.quantity * item.rate),
          sortOrder: index,
        }))
      )
      .returning();

    // Move the lead into the "Quoted" stage now that a quotation exists —
    // but never regress a lead that's already reached a terminal state
    // (e.g. a revised quotation on an already-Won/Lost lead shouldn't undo it).
    if (lead.status !== "WON" && lead.status !== "LOST") {
      await db
        .update(leads)
        .set({ status: "QUOTED", updatedAt: new Date() })
        .where(eq(leads.id, data.leadId));
    }

    return NextResponse.json(
      { quotation: { ...quotation, lineItems: insertedLineItems } },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
