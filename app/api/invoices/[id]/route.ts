import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, payments } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError } from "@/lib/api-helpers";
import { and, asc, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.manufacturerId, manufacturer.id)));

    if (!invoice) return jsonError("Invoice not found", 404);

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, id))
      .orderBy(asc(payments.paidAt));

    return NextResponse.json({ invoice: { ...invoice, payments: paymentRows } });
  } catch (err) {
    return handleApiError(err);
  }
}
