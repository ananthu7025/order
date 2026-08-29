import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, products } from "@/lib/db/schema";
import { getCurrentManufacturer } from "@/lib/manufacturer";
import { handleApiError } from "@/lib/api-helpers";
import { desc, eq, sql } from "drizzle-orm";

// Aggregate counts used by the Dashboard and Reports & Analytics screens.
// Computed on read rather than cached — MVP data volume makes this fine.
export async function GET() {
  try {
    const manufacturer = await getCurrentManufacturer();

    const [productCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.manufacturerId, manufacturer.id));

    const leadCountsByStatus = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(eq(leads.manufacturerId, manufacturer.id))
      .groupBy(leads.status);

    const statusCounts = {
      NEW: 0,
      CONTACTED: 0,
      INTERESTED: 0,
      QUOTED: 0,
      WON: 0,
      LOST: 0,
    };
    for (const row of leadCountsByStatus) {
      statusCounts[row.status] = row.count;
    }

    const totalLeads = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const activeLeads = statusCounts.CONTACTED + statusCounts.INTERESTED + statusCounts.QUOTED;

    const recentLeads = await db
      .select()
      .from(leads)
      .where(eq(leads.manufacturerId, manufacturer.id))
      .orderBy(desc(leads.createdAt))
      .limit(5);

    const topProducts = await db
      .select()
      .from(products)
      .where(eq(products.manufacturerId, manufacturer.id))
      .orderBy(desc(products.viewCount))
      .limit(5);

    return NextResponse.json({
      productCount: productCount?.count ?? 0,
      leadStatusCounts: statusCounts,
      totalLeads,
      activeLeads,
      wonLeads: statusCounts.WON,
      lostLeads: statusCounts.LOST,
      recentLeads,
      topProducts,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
