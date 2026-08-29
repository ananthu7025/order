import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError } from "@/lib/api-helpers";
import { desc, eq } from "drizzle-orm";

// List all leads for the current manufacturer. Used by the Leads dashboard
// screen (status tabs are filtered client-side against this full list for
// this MVP's data volume).
export async function GET() {
  try {
    const manufacturer = await getCurrentManufacturer();

    const rows = await db
      .select()
      .from(leads)
      .where(eq(leads.manufacturerId, manufacturer.id))
      .orderBy(desc(leads.createdAt));

    return NextResponse.json({ leads: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
