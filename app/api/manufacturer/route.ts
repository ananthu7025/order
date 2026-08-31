import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { manufacturers } from "@/lib/db/schema";
import { getCurrentManufacturer, toPublicManufacturer } from "@/lib/manufacturer";
import { handleApiError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

const updateManufacturerSchema = z.object({
  companyName: z.string().min(1).optional(),
  businessType: z.string().optional(),
  aboutCompany: z.string().optional(),
  yearEstablished: z.string().optional(),
  gstin: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  businessLocation: z.string().optional(),
  manufacturingLocations: z.string().optional(),
  logoUrl: z.string().optional(),
  categories: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const manufacturer = await getCurrentManufacturer();
    return NextResponse.json({ manufacturer: toPublicManufacturer(manufacturer) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const manufacturer = await getCurrentManufacturer();
    const body = await req.json();
    const data = updateManufacturerSchema.parse(body);

    const [updated] = await db
      .update(manufacturers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(manufacturers.id, manufacturer.id))
      .returning();

    return NextResponse.json({ manufacturer: toPublicManufacturer(updated) });
  } catch (err) {
    return handleApiError(err);
  }
}
