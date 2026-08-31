import { db } from "@/lib/db";
import { products, manufacturers } from "@/lib/db/schema";
import { and, desc, eq, or, ilike, sql, type SQL } from "drizzle-orm";
import type { SearchIntent } from "./intent";
import { buildEligibilityTerms, coreConcept } from "./synonyms";

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
 * Eligibility vs. ranking — this is the important distinction:
 * - coreTerms (from intent.product, expanded to product-family siblings —
 *   box<->carton, bag<->pouch, via lib/search/synonyms.ts) are the ONLY
 *   thing that determines whether a product qualifies at all (matchWords
 *   below). A generic adjective like "packing"/"packaging"/"shipping"
 *   must never be treated as a product-family synonym here — an earlier
 *   version expanded "packing" <-> "packaging" directly and OR'd them into
 *   the eligibility query, which meant ANY product whose category said
 *   "Packaging Materials" qualified for a box search (surfacing "Kraft
 *   Paper Bags" for "packing boxes"). Product-family expansion fixes that:
 *   "packing"/"corrugated"/"shipping" stay as plain words with no
 *   synonyms, so they can still match a listing that literally contains
 *   them, but they can't drag in an unrelated product family.
 * - secondaryTerms (intent.category + intent.attributes) and the raw,
 *   unexpanded product words are folded in ONLY as ranking signal
 *   (rankExtraWords) — present to push a better-matching listing higher,
 *   never required for a match, so they can't cause an otherwise-good
 *   product-name match to disappear, and can't independently qualify an
 *   unrelated product either (category alone never reaches matchWords).
 *
 * Query words within coreTerms are OR'd together (not
 * websearch_to_tsquery's/plainto_tsquery's implicit AND between words) —
 * a buyer saying "corrugated packing boxes" must still match a listing
 * titled "Corrugated Box" even though "packing" doesn't stem to the same
 * root as "Packaging" in the listing's category.
 *
 * If the primary search (full product phrase, family-expanded) returns
 * nothing, a fallback search narrows to just the buyer's core product noun
 * (skipping descriptive adjectives — see coreConcept in synonyms.ts, e.g.
 * "boxes" out of "corrugated packing boxes") and tries again — still fully
 * database-backed and deterministic, never inventing a product.
 *
 * intent.quantity is never part of the text query — nothing to filter it
 * against — and intent.location is applied as a separate ILIKE filter,
 * not word-matched.
 */
export async function searchProducts(intent: SearchIntent): Promise<ProductSearchResult[]> {
  console.log("[search] intent", intent);

  const coreWords = intent.product ? toWords(intent.product) : [];
  const secondaryTerms = [intent.category, intent.attributes].filter(Boolean).flatMap((t) => toWords(t as string));

  if (coreWords.length === 0 && secondaryTerms.length === 0) {
    console.log("[search] normalized product query: (none — nothing to search)");
    return [];
  }

  // Eligibility gate: only the buyer's actual product words (with generic
  // descriptive/category words like "packaging" stripped out, and the
  // remainder expanded to product-family siblings) — never raw
  // category/attributes text, see the eligibility-vs-ranking note above.
  // If the buyer named no product at all, secondaryTerms (category +
  // attributes) is the best signal available, so it goes through the same
  // stripping/expansion rather than being used as a raw eligibility gate.
  const coreTerms = buildEligibilityTerms(coreWords.length > 0 ? coreWords : secondaryTerms);
  console.log("[search] normalized product query", { coreTerms, secondaryTerms });

  console.log("[search] primary search", { matchWords: coreTerms, rankExtraWords: secondaryTerms, location: intent.location });
  const primaryResults = await runFullTextSearch({
    matchWords: coreTerms,
    rankExtraWords: secondaryTerms,
    location: intent.location,
  });
  console.log("[search] primary result count", primaryResults.length);

  if (primaryResults.length > 0) return primaryResults;

  // Fallback: narrow to the buyer's core product noun (e.g. "boxes" out of
  // "corrugated packing boxes", skipping the descriptive adjective) and
  // search again. Only runs when the primary search — already broadened
  // by product-family expansion — found nothing, so a buyer whose exact
  // wording doesn't appear anywhere still has a chance to surface the
  // closest real listings instead of a flat "no matches". Still gated on
  // product-family terms only, never category/attributes.
  const fallbackWords = coreConcept(coreWords.length > 0 ? coreWords : secondaryTerms);
  if (fallbackWords.length === 0 || fallbackWords.join("|") === coreTerms.join("|")) {
    console.log("[search] fallback search: skipped (no narrower core concept to try)");
    return [];
  }

  console.log("[search] fallback search", { matchWords: fallbackWords, location: intent.location });
  const fallbackResults = await runFullTextSearch({
    matchWords: fallbackWords,
    rankExtraWords: secondaryTerms,
    location: intent.location,
  });
  console.log("[search] fallback result count", fallbackResults.length);

  return fallbackResults;
}
