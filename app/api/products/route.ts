import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError } from "@/lib/api-helpers";
import { desc, eq } from "drizzle-orm";

const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
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

export async function GET() {
  try {
    const manufacturer = await getCurrentManufacturer();

    const rows = await db
      .select()
      .from(products)
      .where(eq(products.manufacturerId, manufacturer.id))
      .orderBy(desc(products.createdAt));

    return NextResponse.json({ products: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = createProductSchema.parse(body);

    const [product] = await db
      .insert(products)
      .values({
        manufacturerId: manufacturer.id,
        name: data.name,
        category: data.category,
        description: data.description,
        status: data.status ?? "DRAFT",
        material: data.material,
        size: data.size,
        gsmOrThickness: data.gsmOrThickness,
        color: data.color,
        weight: data.weight,
        capacity: data.capacity,
        customization: data.customization,
        otherSpecs: data.otherSpecs,
        moq: data.moq,
        priceMin: data.priceMin != null ? String(data.priceMin) : undefined,
        priceMax: data.priceMax != null ? String(data.priceMax) : undefined,
        packingCharges: data.packingCharges,
        shippingCharges: data.shippingCharges,
        otherCharges: data.otherCharges,
        paymentTerms: data.paymentTerms,
        leadTime: data.leadTime,
        availableCapacity: data.availableCapacity,
        deliveryLocations: data.deliveryLocations,
        customManufacturing: data.customManufacturing ?? false,
        coverImageUrl: data.coverImageUrl,
        images: data.images ?? [],
        documents: data.documents ?? [],
      })
      .returning();

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
