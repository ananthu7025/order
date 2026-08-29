import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads, products } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError } from "@/lib/api-helpers";
import { and, eq } from "drizzle-orm";

const updateLeadSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "INTERESTED", "QUOTED", "WON", "LOST"]).optional(),
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

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.manufacturerId, manufacturer.id)));

    if (!lead) return jsonError("Lead not found", 404);

    let matchedProduct = null;
    if (lead.matchedProductId) {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, lead.matchedProductId));
      matchedProduct = product ?? null;
    }

    return NextResponse.json({ lead, matchedProduct });
  } catch (err) {
    return handleApiError(err);
  }
}

// General-purpose update — used by the dashboard UI for status changes,
// notes, and manual corrections to structured fields.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = updateLeadSchema.parse(body);

    const [existing] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.manufacturerId, manufacturer.id)));

    if (!existing) return jsonError("Lead not found", 404);

    const [lead] = await db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();

    return NextResponse.json({ lead });
  } catch (err) {
    return handleApiError(err);
  }
}
