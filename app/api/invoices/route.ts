import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoices, quotations, leads } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError, generateNumber } from "@/lib/api-helpers";
import { desc, eq } from "drizzle-orm";

const createInvoiceSchema = z.object({
  quotationId: z.string().min(1),
  billToName: z.string().min(1),
  billToAddress: z.string().optional(),
  billToPhone: z.string().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const manufacturer = await getCurrentManufacturer();

    const rows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.manufacturerId, manufacturer.id))
      .orderBy(desc(invoices.createdAt));

    return NextResponse.json({ invoices: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// Generates an invoice from a quotation. The quotation's subtotal is split
// evenly into CGST/SGST (matching the invoice screen's design) rather than
// a single combined GST line, since Indian intra-state invoices show both.
export async function POST(req: NextRequest) {
  try {
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = createInvoiceSchema.parse(body);

    const [quotation] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, data.quotationId));

    if (!quotation || quotation.manufacturerId !== manufacturer.id) {
      return jsonError("Quotation not found", 404);
    }

    const gstAmount = Number(quotation.gstAmount);
    const halfGst = Math.round((gstAmount / 2) * 100) / 100;

    const [invoice] = await db
      .insert(invoices)
      .values({
        manufacturerId: manufacturer.id,
        quotationId: quotation.id,
        invoiceNumber: generateNumber("INV"),
        status: "UNPAID",
        billToName: data.billToName,
        billToAddress: data.billToAddress,
        billToPhone: data.billToPhone,
        subtotal: quotation.subtotal,
        cgstAmount: String(halfGst),
        sgstAmount: String(halfGst),
        totalAmount: quotation.totalAmount,
        amountPaid: "0",
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
        notes: data.notes,
      })
      .returning();

    // Ensure the lead is marked Won once billing starts, in case the
    // quotation wasn't explicitly marked ACCEPTED first.
    await db
      .update(leads)
      .set({ status: "WON", updatedAt: new Date() })
      .where(eq(leads.id, quotation.leadId));

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
