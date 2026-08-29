import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoices, payments } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError } from "@/lib/api-helpers";
import { and, eq } from "drizzle-orm";

const recordPaymentSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  method: z.string().optional(),
  note: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = recordPaymentSchema.parse(body);

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.manufacturerId, manufacturer.id)));

    if (!invoice) return jsonError("Invoice not found", 404);

    const [payment] = await db
      .insert(payments)
      .values({
        invoiceId: id,
        amount: String(Number(data.amount)),
        method: data.method,
        note: data.note,
      })
      .returning();

    const newAmountPaid =
      Math.round((Number(invoice.amountPaid) + Number(data.amount)) * 100) / 100;
    const totalAmount = Number(invoice.totalAmount);

    const status =
      newAmountPaid >= totalAmount ? "PAID" : newAmountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";

    const [updatedInvoice] = await db
      .update(invoices)
      .set({ amountPaid: String(newAmountPaid), status, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();

    return NextResponse.json({ payment, invoice: updatedInvoice }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
