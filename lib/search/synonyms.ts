/**
 * Small, deterministic word-expansion map for the product search fallback
 * (lib/search/products.ts). Deliberately NOT exhaustive or automatic —
 * only words actually seen in buyer phrasing for this catalog's domain
 * (packaging) are mapped, so expansion stays predictable and doesn't drag
 * in unrelated products. Extend this list as real buyer queries reveal
 * gaps, rather than trying to anticipate every synonym up front.
 *
 * Matching is case-insensitive and whole-word (see expandWords below) —
 * "boxes" expands via the "boxes" entry, "box" via the separate "box"
 * entry, so plurals need their own line rather than relying on stemming.
 */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  box: ["boxes", "carton", "cartons"],
  boxes: ["box", "carton", "cartons"],
  carton: ["cartons", "box", "boxes"],
  cartons: ["carton", "box", "boxes"],
  packing: ["packaging"],
  packaging: ["packing"],
  bag: ["bags", "pouch", "pouches"],
  bags: ["bag", "pouch", "pouches"],
};

/**
 * Expands each word in the input to include its mapped synonyms (if any),
 * de-duplicated, preserving the original words first. Only touches words
 * present in SEARCH_SYNONYMS — everything else passes through unchanged.
 */
export function expandWords(words: string[]): string[] {
  const expanded = new Set<string>();
  for (const word of words) {
    expanded.add(word);
    const synonyms = SEARCH_SYNONYMS[word.toLowerCase()];
    if (synonyms) {
      for (const synonym of synonyms) expanded.add(synonym);
    }
  }
  return [...expanded];
}

/**
 * Reduces a product phrase down to its core noun(s) for the fallback
 * search — e.g. "corrugated packing boxes" -> "boxes". Deliberately naive
 * (last word, plus its synonyms): the fallback only needs to be broader
 * than the primary search, not clever, since ts_rank still sorts real
 * matches above weak ones and the primary search already tried the full
 * phrase first.
 */
export function coreConcept(words: string[]): string[] {
  if (words.length === 0) return [];
  const lastWord = words[words.length - 1];
  return expandWords([lastWord]);
}
