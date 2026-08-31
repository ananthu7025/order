import { db } from "@/lib/db";
import { products, manufacturers } from "@/lib/db/schema";
import { and, desc, eq, or, ilike, sql, type SQL } from "drizzle-orm";
import type { SearchIntent } from "./intent";
import { expandWords, coreConcept } from "./synonyms";

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
 * Splits free text into plain alphanumeric words, dropping anything
 * to_tsquery's strict syntax would choke on (unlike websearch_to_tsquery,
 * it throws on "&", ":", stray quotes — all realistic in LLM output).
 */
function toWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
}

function toOrQueryString(words: string[]): string | null {
  return words.length > 0 ? words.join(" | ") : null;
}

type RunSearchArgs = {
  matchWords: string[];
  rankExtraWords: string[];
  location: string | null;
};

/**
 * Runs one full-text search pass: matches products whose weighted vector
 * (name+category weighted 'A', description+material+otherSpecs weighted
 * 'B' — a name/category hit ranks above a description-only hit) contains
 * ANY of matchWords (OR'd, not AND'd — see module docs below), optionally
 * narrowed by a location filter, ranked by how many of matchWords +
 * rankExtraWords each result matches.
 *
 * Shared by the primary search and the fallback search in searchProducts()
 * below — same weighting and filters, different word lists.
 */
async function runFullTextSearch({ matchWords, rankExtraWords, location }: RunSearchArgs): Promise<ProductSearchResult[]> {
  const matchQueryString = toOrQueryString(matchWords);
  if (!matchQueryString) return [];

  const weightedVector = sql`(
    setweight(to_tsvector('english', ${products.name} || ' ' || ${products.category}), 'A') ||
    setweight(to_tsvector('english', coalesce(${products.description}, '') || ' ' || coalesce(${products.material}, '') || ' ' || coalesce(${products.otherSpecs}, '')), 'B')
  )`;

  const matchQuery = sql`to_tsquery('english', ${matchQueryString})`;

  const rankQueryString = toOrQueryString([...matchWords, ...rankExtraWords]);
  const rankQuery = rankQueryString ? sql`to_tsquery('english', ${rankQueryString})` : matchQuery;
  const rank = sql<number>`ts_rank(${weightedVector}, ${rankQuery})`;

  const conditions: SQL[] = [
    eq(products.status, "PUBLISHED"),
    eq(manufacturers.verificationStatus, "VERIFIED"),
    sql`${weightedVector} @@ ${matchQuery}`,
  ];

  if (location) {
    const pattern = `%${location}%`;
    const locationCondition = or(ilike(products.deliveryLocations, pattern), ilike(manufacturers.businessLocation, pattern));
    if (locationCondition) conditions.push(locationCondition);
  }

  return db
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
}

/**
 * Full-text search across every PUBLISHED product from every VERIFIED
 * manufacturer — the retrieval half of the intent -> search -> rank ->
 * respond pipeline. The LLM (lib/search/intent.ts) only ever decides what
 * the buyer wants; this is the only place actual product data is read, so
 * results are guaranteed to be real listings, never hallucinated ones.
 *
 * Postgres to_tsvector/tsquery + ts_rank stands in for what a larger
 * deployment would run as MongoDB Atlas Search or a vector index — same
 * role (rank text relevance), same position in the pipeline, no new
 * infrastructure needed since this project is already on Postgres.
 *
 * No new "searchKeywords" column: the schema already has otherSpecs (free
 * text) for a manufacturer to add related terms, and description/material
 * are already searched too — a new column would duplicate what these
 * three already cover. Revisit only if real usage shows manufacturers
 * need to attach searchable synonyms independent of their actual spec
 * text, which nothing so far indicates.
 *
 * Query words are OR'd together (not websearch_to_tsquery's/
 * plainto_tsquery's implicit AND between words) — a buyer saying
 * "corrugated packing boxes" must still match a listing titled
 * "Corrugated Box" even though "packing" doesn't stem to the same root as
 * "Packaging" in the listing's category, and a buyer padding their
 * message with adjectives the listing never repeats shouldn't zero out
 * every result just because one word doesn't appear anywhere.
 *
 * lib/search/synonyms.ts additionally expands a handful of known
 * packaging-domain words (box/boxes/carton/cartons, packing/packaging,
 * bag/bags/pouch/pouches) so "carton boxes" also matches a listing that
 * only says "Box", without resorting to stemming or a vector index.
 *
 * If the expanded primary search returns nothing, a fallback search
 * narrows to just the core noun of what the buyer asked for (last word +
 * its synonyms, e.g. "boxes" out of "corrugated packing boxes") and tries
 * again — still fully database-backed and deterministic, never inventing
 * a product. intent.category/attributes are folded in only as a ranking
 * signal (via rankExtraWords), never required for a match, so they can't
 * cause an otherwise-good product-name match to disappear. intent.quantity
 * is never part of the text query — nothing to filter it against — and
 * intent.location is applied as a separate ILIKE filter, not word-matched.
 */
export async function searchProducts(intent: SearchIntent): Promise<ProductSearchResult[]> {
  console.log("[search] intent", intent);

  const productWords = intent.product ? toWords(intent.product) : [];
  const secondaryWords = [intent.category, intent.attributes].filter(Boolean).flatMap((t) => toWords(t as string));

  if (productWords.length === 0 && secondaryWords.length === 0) {
    console.log("[search] normalized product query: (none — nothing to search)");
    return [];
  }

  const expandedProductWords = expandWords(productWords.length > 0 ? productWords : secondaryWords);
  console.log("[search] normalized product query", expandedProductWords.join(" | ") || "(empty)");

  console.log("[search] primary search", { matchWords: expandedProductWords, rankExtraWords: secondaryWords, location: intent.location });
  const primaryResults = await runFullTextSearch({
    matchWords: expandedProductWords,
    rankExtraWords: secondaryWords,
    location: intent.location,
  });
  console.log("[search] primary result count", primaryResults.length);

  if (primaryResults.length > 0) return primaryResults;

  // Fallback: narrow to the core concept (e.g. "boxes" out of "corrugated
  // packing boxes") and search again. Only runs when the primary search —
  // already broadened by synonym expansion — found nothing, so a buyer
  // whose exact wording doesn't appear anywhere still has a chance to
  // surface the closest real listings instead of a flat "no matches".
  const fallbackWords = coreConcept(productWords.length > 0 ? productWords : secondaryWords);
  if (fallbackWords.length === 0 || fallbackWords.join("|") === expandedProductWords.join("|")) {
    console.log("[search] fallback search: skipped (no narrower core concept to try)");
    return [];
  }

  console.log("[search] fallback search", { matchWords: fallbackWords, location: intent.location });
  const fallbackResults = await runFullTextSearch({
    matchWords: fallbackWords,
    rankExtraWords: secondaryWords,
    location: intent.location,
  });
  console.log("[search] fallback result count", fallbackResults.length);

  return fallbackResults;
}
