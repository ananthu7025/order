import { db } from "@/lib/db";
import { products, manufacturers } from "@/lib/db/schema";
import { and, desc, eq, or, ilike, sql, type SQL } from "drizzle-orm";
import type { SearchIntent } from "./intent";

export type ProductSearchResult = {
  productId: string;
  productName: string;
  category: string;
  description: string | null;
  moq: string | null;
  deliveryLocations: string | null;
  manufacturerId: string;
  manufacturerName: string;
};

const MAX_RESULTS = 8;

/**
 * Full-text search across every PUBLISHED product from every VERIFIED
 * manufacturer — the retrieval half of the intent -> search -> rank ->
 * respond pipeline. The LLM (lib/search/intent.ts) only ever decides what
 * the buyer wants; this is the only place actual product data is read, so
 * results are guaranteed to be real listings, never hallucinated ones.
 *
 * Postgres to_tsvector/websearch_to_tsquery + ts_rank stands in for what a
 * larger deployment would run as MongoDB Atlas Search or a vector index —
 * same role (rank text relevance), same position in the pipeline, no new
 * infrastructure needed since this project is already on Postgres.
 *
 * Falls back to returning zero results (never throws) if intent has
 * nothing to search on, so a vague buyer message just means "no matches
 * yet" rather than an error.
 */
export async function searchProducts(intent: SearchIntent): Promise<ProductSearchResult[]> {
  const queryText = [intent.product, intent.category, intent.attributes].filter(Boolean).join(" ").trim();
  if (!queryText) return [];

  const searchVector = sql`to_tsvector('english', ${products.name} || ' ' || ${products.category} || ' ' || coalesce(${products.description}, '') || ' ' || coalesce(${products.material}, '') || ' ' || coalesce(${products.otherSpecs}, ''))`;
  const searchQuery = sql`websearch_to_tsquery('english', ${queryText})`;
  const rank = sql<number>`ts_rank(${searchVector}, ${searchQuery})`;

  const conditions: SQL[] = [
    eq(products.status, "PUBLISHED"),
    eq(manufacturers.verificationStatus, "VERIFIED"),
    sql`${searchVector} @@ ${searchQuery}`,
  ];

  if (intent.location) {
    const pattern = `%${intent.location}%`;
    const locationCondition = or(ilike(products.deliveryLocations, pattern), ilike(manufacturers.businessLocation, pattern));
    if (locationCondition) conditions.push(locationCondition);
  }

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      category: products.category,
      description: products.description,
      moq: products.moq,
      deliveryLocations: products.deliveryLocations,
      manufacturerId: manufacturers.id,
      manufacturerName: manufacturers.companyName,
    })
    .from(products)
    .innerJoin(manufacturers, eq(products.manufacturerId, manufacturers.id))
    .where(and(...conditions))
    .orderBy(desc(rank))
    .limit(MAX_RESULTS);

  return rows;
}
