/**
 * Product-family groups for the search eligibility gate (lib/search/products.ts).
 *
 * This is deliberately NOT a flat word->synonym map. An earlier version
 * mapped "packing" <-> "packaging" as direct synonyms and OR'd them
 * straight into the eligibility query — which meant ANY product whose
 * category happened to say "Packaging Materials" (i.e. every product in
 * this catalog) qualified for a "packing boxes" search, surfacing "Kraft
 * Paper Bags" for a box query. Removing that synonym pair wasn't enough
 * on its own either: the buyer's own literal word "packaging" (e.g. in
 * "packaging boxes") still made it into the eligibility set unexpanded,
 * and "Packaging Materials" is literally every product's category text in
 * this catalog — so it matched everything regardless of synonyms.
 *
 * The actual fix has two parts:
 * 1. Only ever expand a word into its PRODUCT-FAMILY siblings (box<->
 *    carton, bag<->pouch) — physically-the-same-kind-of-thing nouns —
 *    never into a generic packaging adjective like "packing", "shipping",
 *    or "corrugated".
 * 2. Strip generic descriptive/category-echoing words (DESCRIPTIVE_WORDS
 *    below — "packing", "packaging", "shipping", "corrugated", etc.) out
 *    of the eligibility set entirely, in buildEligibilityTerms(). They
 *    still matter for relevance — lib/search/products.ts folds the full,
 *    unstripped word list into rankExtraWords for ranking — they just can
 *    no longer single-handedly qualify a product for eligibility, since
 *    "packaging" appearing in a category string tells you nothing about
 *    which product family the buyer actually wants.
 *
 * Deliberately small and hand-maintained — only families/words actually
 * seen in this catalog's domain (packaging). Extend as real buyer queries
 * reveal gaps, rather than trying to anticipate every case up front.
 */
const PRODUCT_FAMILIES: string[][] = [
  ["box", "boxes", "carton", "cartons"],
  ["bag", "bags", "pouch", "pouches"],
];

const FAMILY_BY_WORD = new Map<string, string[]>();
for (const family of PRODUCT_FAMILIES) {
  for (const word of family) {
    FAMILY_BY_WORD.set(word, family);
  }
}

/**
 * Generic descriptive/category-echoing words that describe HOW a product
 * is made or used, not WHAT product family it belongs to. Stripped out of
 * the eligibility gate (buildEligibilityTerms) since a word like
 * "packaging" appears in nearly every listing's category text regardless
 * of what the product actually is — but still passed through to ranking
 * (lib/search/products.ts's rankExtraWords), so a listing that also
 * literally contains "corrugated" or "shipping" still ranks higher than
 * one that doesn't.
 */
const DESCRIPTIVE_WORDS = new Set([
  "packing",
  "packaging",
  "shipping",
  "corrugated",
  "custom",
  "printed",
  "industrial",
  "heavy",
  "duty",
  "material",
  "materials",
]);

/**
 * Specific material/type words the buyer might name (e.g. "plastic bags",
 * "wooden pallets", "glass bottles"). Unlike DESCRIPTIVE_WORDS, these are
 * NOT stripped from eligibility — they're pulled out into a separate
 * REQUIRED (AND'd) condition in lib/search/products.ts, because an OR'd
 * generic noun alone isn't enough to rule out a mismatch: "plastic bags"
 * OR-matching on "bags" alone would wrongly return a paper-bag listing,
 * since to_tsquery's OR only needs ANY term to hit. Requiring "plastic" to
 * also literally appear on the listing means a paper-bag product correctly
 * fails to qualify, while a listing that genuinely says "plastic" still
 * matches normally.
 */
const MATERIAL_WORDS = new Set(["plastic", "glass", "metal", "wooden", "wood", "steel", "aluminum", "rubber", "cotton", "cloth"]);

/**
 * Splits a buyer's product words into the eligibility word set (OR'd —
 * generic descriptive words stripped, remainder expanded to product-family
 * siblings, e.g. "boxes" also matches a listing that only says "carton")
 * and a required word set (AND'd — specific materials the buyer named,
 * which must actually appear on the listing, not just be one option among
 * several). If every word turns out to be descriptive (e.g. the buyer only
 * said "corrugated" with no noun), the eligibility set falls back to the
 * original words rather than ending up empty — better to search on what's
 * there than search on nothing.
 */
export function buildEligibilityTerms(words: string[]): { matchWords: string[]; requiredWords: string[] } {
  const requiredWords = words.filter((w) => MATERIAL_WORDS.has(w.toLowerCase()));
  const core = words.filter((w) => !DESCRIPTIVE_WORDS.has(w.toLowerCase()) && !MATERIAL_WORDS.has(w.toLowerCase()));
  const base = core.length > 0 ? core : words;

  const expanded = new Set<string>();
  for (const word of base) {
    expanded.add(word);
    const family = FAMILY_BY_WORD.get(word.toLowerCase());
    if (family) {
      for (const sibling of family) expanded.add(sibling);
    }
  }
  return { matchWords: [...expanded], requiredWords };
}

/**
 * Picks the buyer's core product noun(s) for the fallback search — e.g.
 * "corrugated packing boxes" -> "boxes", skipping past descriptive
 * adjectives to find the actual product word. Falls back to the last word
 * if every word is descriptive, and expands whatever it lands on to its
 * product family. Deliberately naive beyond that: the fallback only needs
 * to be broader than the primary search, not clever, since ts_rank still
 * sorts real matches above weak ones and the primary search already tried
 * the full phrase (with family expansion) first.
 */
export function coreConcept(words: string[]): string[] {
  if (words.length === 0) return [];
  const nonDescriptive = [...words].reverse().find((w) => !DESCRIPTIVE_WORDS.has(w.toLowerCase()) && !MATERIAL_WORDS.has(w.toLowerCase()));
  const coreWord = nonDescriptive ?? words[words.length - 1];
  return buildEligibilityTerms([coreWord]).matchWords;
}
