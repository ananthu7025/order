import { db } from "@/lib/db";
import { manufacturers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

/**
 * No auth in this MVP — there is exactly one manufacturer row (created by
 * lib/db/seed.ts). Every API route resolves "the current manufacturer"
 * through this helper instead of a session, so swapping in real auth later
 * only means changing this one function.
 */
export async function getCurrentManufacturer() {
  const [manufacturer] = await db
    .select()
    .from(manufacturers)
    .orderBy(asc(manufacturers.createdAt))
    .limit(1);

  if (!manufacturer) {
    throw new Error(
      "No manufacturer found. Run `npm run db:seed` to create the demo manufacturer."
    );
  }

  return manufacturer;
}
