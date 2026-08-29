import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError } from "@/lib/api-helpers";
import { and, eq } from "drizzle-orm";

/**
 * Called by the future LLM extraction step once it has parsed a raw
 * WhatsApp message into structured fields. Kept separate from the general
 * PATCH /api/leads/:id so the "AI just extracted this" write path is
 * distinct from a human editing the lead in the dashboard — useful later
 * for auditing which fields came from the model vs. a manual edit.
 */
const extractSchema = z.object({
  buyerName: z.string().optional(),
  businessName: z.string().optional(),
  productText: z.string().optional(),
  matchedProductId: z.string().optional(),
  quantity: z.string().optional(),
  specification: z.string().optional(),
  location: z.string().optional(),
  deadline: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = extractSchema.parse(body);

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
