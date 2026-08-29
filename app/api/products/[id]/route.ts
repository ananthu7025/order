import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError } from "@/lib/api-helpers";
import { and, eq, sql } from "drizzle-orm";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "INACTIVE"]).optional(),

  material: z.string().optional(),
  size: z.string().optional(),
  gsmOrThickness: z.string().optional(),
  color: z.string().optional(),
  weight: z.string().optional(),
  capacity: z.string().optional(),
  customization: z.string().optional(),
  otherSpecs: z.string().optional(),

  moq: z.string().optional(),
  priceMin: z.union([z.string(), z.number()]).optional(),
  priceMax: z.union([z.string(), z.number()]).optional(),
  packingCharges: z.string().optional(),
  shippingCharges: z.string().optional(),
  otherCharges: z.string().optional(),
  paymentTerms: z.string().optional(),

  leadTime: z.string().optional(),
  availableCapacity: z.string().optional(),
  deliveryLocations: z.string().optional(),
  customManufacturing: z.boolean().optional(),

  coverImageUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
  documents: z.array(z.string()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();

    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.manufacturerId, manufacturer.id)));

    if (!product) return jsonError("Product not found", 404);

    // Track a view every time the detail page is fetched — mirrors the
    // "Product Views" metric used on the dashboard/reports screens.
    await db
      .update(products)
      .set({ viewCount: sql`${products.viewCount} + 1` })
      .where(eq(products.id, id));

    return NextResponse.json({ product: { ...product, viewCount: product.viewCount + 1 } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = updateProductSchema.parse(body);

    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.manufacturerId, manufacturer.id)));

    if (!existing) return jsonError("Product not found", 404);

    const [product] = await db
      .update(products)
      .set({
        ...data,
        priceMin: data.priceMin != null ? String(data.priceMin) : undefined,
        priceMax: data.priceMax != null ? String(data.priceMax) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return NextResponse.json({ product });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const manufacturer = await getCurrentManufacturer();

    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.manufacturerId, manufacturer.id)));

    if (!existing) return jsonError("Product not found", 404);

    await db.delete(products).where(eq(products.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
