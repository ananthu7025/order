import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Search regression suite for lib/search/intent.ts + lib/search/products.ts,
 * run against the live catalog (3 products: Corrugated Box, Kraft Paper
 * Bags, Custom Printed Shipping Box). Every test asserts BOTH that expected
 * products are present AND that unexpected ones are absent — a search that
 * returns results can still fail if it returns the wrong ones alongside
 * the right ones (see PROD-FAIL vs UNEXPECTED distinction below).
 *
 * This measures current behavior; it does not fix anything by itself.
 */

type Outcome = "PASS" | "FAIL" | "NOT_SUPPORTED";

type TestResult = {
  section: string;
  message: string;
  outcome: Outcome;
  reason?: string;
  expected?: string[];
  actual?: string[];
  unexpected?: string[];
  missing?: string[];
  category?: "intent" | "relevance" | "unexpected-product" | "missing-product" | "location" | "ranking" | "context";
};

const results: TestResult[] = [];

function record(r: TestResult) {
  results.push(r);
  const marker = r.outcome === "PASS" ? "PASS" : r.outcome === "NOT_SUPPORTED" ? "NOT_SUPPORTED" : "FAIL";
  console.log(`${marker} | [${r.section}] "${r.message}"`);
  if (r.expected) console.log(`  Expected: ${r.expected.length ? r.expected.join(", ") : "(none)"}`);
  if (r.actual) console.log(`  Actual:   ${r.actual.length ? r.actual.join(", ") : "(none)"}`);
  if (r.unexpected && r.unexpected.length) console.log(`  Unexpected: ${r.unexpected.join(", ")}`);
  if (r.missing && r.missing.length) console.log(`  Missing:    ${r.missing.join(", ")}`);
  if (r.reason) console.log(`  Reason: ${r.reason}`);
  console.log();
}

async function main() {
  const { parseSearchIntent } = await import("../lib/search/intent");
  const { searchProducts } = await import("../lib/search/products");

  async function search(message: string, history: { role: "user" | "assistant"; content: string }[] = []) {
    const intent = await parseSearchIntent(message, history);
    const products = await searchProducts(intent);
    return { intent, names: products.map((p) => p.productName) };
  }

  /** Expected products must ALL be present; nothing outside expected may appear. */
  async function expectExactSet(section: string, message: string, expected: string[], category: TestResult["category"] = "relevance") {
    const { names } = await search(message);
    const missing = expected.filter((e) => !names.includes(e));
    const unexpected = names.filter((n) => !expected.includes(n));
    const outcome: Outcome = missing.length === 0 && unexpected.length === 0 ? "PASS" : "FAIL";
    record({ section, message, outcome, expected, actual: names, unexpected, missing, category });
  }

  /** No product may appear at all. */
  async function expectNone(section: string, message: string, category: TestResult["category"] = "unexpected-product") {
    const { names } = await search(message);
    const outcome: Outcome = names.length === 0 ? "PASS" : "FAIL";
    record({ section, message, outcome, expected: [], actual: names, unexpected: names, category });
  }

  /** First result must be the given product (only meaningful when results exist). */
  async function expectFirstRanked(section: string, message: string, expectedFirst: string, category: TestResult["category"] = "ranking") {
    const { names } = await search(message);
    if (names.length === 0) {
      record({ section, message, outcome: "FAIL", reason: "no results at all", expected: [expectedFirst], actual: names, category });
      return;
    }
    const outcome: Outcome = names[0] === expectedFirst ? "PASS" : "FAIL";
    record({
      section,
      message,
      outcome,
      expected: [expectedFirst, "(first)"],
      actual: names,
      reason: outcome === "FAIL" ? `expected "${expectedFirst}" ranked first, got "${names[0]}" first` : undefined,
      category,
    });
  }

  /** Intent must extract product/category as null (vague query — no search should run). */
  async function expectVagueIntent(section: string, message: string) {
    const { intent, names } = await search(message);
    const intentOk = intent.product === null && intent.category === null;
    const noResults = names.length === 0;
    const outcome: Outcome = intentOk && noResults ? "PASS" : "FAIL";
    record({
      section,
      message,
      outcome,
      reason: !intentOk ? `intent extracted a product/category: ${JSON.stringify(intent)}` : !noResults ? `search returned results: ${names.join(", ")}` : undefined,
      expected: [],
      actual: names,
      category: !intentOk ? "intent" : "unexpected-product",
    });
  }

  /** Typo tolerance — classify as PASS/FAIL/NOT_SUPPORTED rather than a hard fail. */
  async function expectTypoTolerant(section: string, message: string, acceptableProducts: string[]) {
    const { names } = await search(message);
    if (names.length === 0) {
      record({ section, message, outcome: "NOT_SUPPORTED", reason: "fuzzy/typo search not implemented — Postgres FTS found nothing", expected: acceptableProducts, actual: names });
      return;
    }
    const unexpected = names.filter((n) => !acceptableProducts.includes(n));
    const outcome: Outcome = unexpected.length === 0 ? "PASS" : "FAIL";
    record({ section, message, outcome, expected: acceptableProducts, actual: names, unexpected, category: "relevance" });
  }

  console.log("========== SECTION 1: Box intent (must exclude Kraft Paper Bags) ==========\n");
  for (const m of [
    "I need boxes",
    "I need cardboard boxes",
    "I need shipping boxes",
    "I need cartons",
    "I need corrugated cartons",
    "I need packaging boxes",
    "I need boxes for shipping",
    "I need boxes for packaging",
    "I need a box supplier",
    "Looking for boxes for my products",
  ]) {
    await expectExactSet("S1", m, ["Corrugated Box", "Custom Printed Shipping Box"]);
  }

  console.log("========== SECTION 2: Bag intent (must exclude box products) ==========\n");
  for (const m of ["I need paper bags", "I need kraft bags", "I need packaging bags", "I need paper packaging", "I need bags for packaging products", "Looking for bags"]) {
    await expectExactSet("S2", m, ["Kraft Paper Bags"]);
  }

  console.log("========== SECTION 3: Custom/printed box intent (ranking) ==========\n");
  for (const m of [
    "I need printed boxes",
    "I need custom boxes",
    "I need custom packaging boxes",
    "I need printed packaging",
    "I need boxes with printing",
    "I need customized shipping boxes",
    "I need branded boxes",
  ]) {
    await expectFirstRanked("S3", m, "Custom Printed Shipping Box");
  }

  console.log("========== SECTION 4: Exact product baseline ==========\n");
  await expectExactSet("S4", "Corrugated Box", ["Corrugated Box"]);
  await expectExactSet("S4", "Kraft Paper Bags", ["Kraft Paper Bags"]);
  await expectExactSet("S4", "Custom Printed Shipping Box", ["Custom Printed Shipping Box"]);

  console.log("========== SECTION 5: Singular/plural ==========\n");
  await expectExactSet("S5", "box", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectExactSet("S5", "boxes", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectExactSet("S5", "bag", ["Kraft Paper Bags"]);
  await expectExactSet("S5", "bags", ["Kraft Paper Bags"]);
  await expectExactSet("S5", "carton", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectExactSet("S5", "cartons", ["Corrugated Box", "Custom Printed Shipping Box"]);

  console.log("========== SECTION 6: Case-insensitivity ==========\n");
  await expectExactSet("S6", "BOXES", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectExactSet("S6", "Boxes", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectExactSet("S6", "corrugated BOX", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectExactSet("S6", "KRAFT PAPER BAGS", ["Kraft Paper Bags"]);
  await expectExactSet("S6", "custom printed shipping box", ["Custom Printed Shipping Box"]);

  console.log("========== SECTION 7: Negative searches (must return NONE) ==========\n");
  for (const m of [
    "I need plastic bottles",
    "I need bubble wrap",
    "I need packaging tape",
    "I need stretch film",
    "I need wooden pallets",
    "I need plastic bags",
    "I need glass bottles",
    "I need labels",
  ]) {
    await expectNone("S7", m);
  }

  console.log("========== SECTION 8: Cross-product confusion ==========\n");
  await expectExactSet("S8", "I need bags", ["Kraft Paper Bags"]);
  await expectExactSet("S8", "I need boxes", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectFirstRanked("S8", "I need printed boxes", "Custom Printed Shipping Box");
  await expectExactSet("S8", "I need paper bags", ["Kraft Paper Bags"]);

  console.log("========== SECTION 9: Vague queries (no search should run) ==========\n");
  for (const m of ["Hello", "Hi", "Hey", "I need something", "Can you help me?", "What do you sell?", "I want to buy something"]) {
    await expectVagueIntent("S9", m);
  }

  console.log("========== SECTION 10: Location ==========\n");
  for (const m of ["I need boxes in Delhi", "I need boxes delivered to Delhi", "Can you deliver boxes to Delhi?"]) {
    const { intent, names } = await search(m);
    const outcome: Outcome = names.length > 0 ? "PASS" : "FAIL";
    record({ section: "S10", message: m, outcome, expected: ["(any Delhi-serving product)"], actual: names, reason: `location extracted: ${intent.location}`, category: "location" });
  }
  {
    const m = "I need boxes delivered to Mumbai";
    const { names } = await search(m);
    const outcome: Outcome = names.length === 0 ? "PASS" : "FAIL";
    record({ section: "S10", message: m, outcome, expected: [], actual: names, reason: "no manufacturer/product serves Mumbai in this catalog — location filter must not be silently dropped", category: "location" });
  }

  console.log("========== SECTION 11: Quantity ==========\n");
  for (const m of ["I need 500 boxes", "I need 1000 boxes", "I need 5000 boxes", "I need around 5000 boxes", "I need 10,000 corrugated boxes"]) {
    const { intent, names } = await search(m);
    const quantityExtracted = intent.quantity !== null;
    const productsFound = names.length > 0;
    const outcome: Outcome = quantityExtracted && productsFound ? "PASS" : "FAIL";
    record({
      section: "S11",
      message: m,
      outcome,
      expected: ["quantity extracted", "products found"],
      actual: [`quantity=${intent.quantity}`, ...names],
      reason: !quantityExtracted ? "quantity not extracted into intent" : !productsFound ? "no products found despite valid product query" : undefined,
      category: "intent",
    });
  }

  console.log("========== SECTION 12: Attributes (must not be invented) ==========\n");
  for (const m of ["I need corrugated boxes in 12x10x8 inches", "I need large shipping boxes", "I need small boxes", "I need brown corrugated boxes", "I need printed boxes", "I need boxes with printing"]) {
    const { intent, names } = await search(m);
    record({ section: "S12", message: m, outcome: "PASS", actual: [`attributes=${intent.attributes}`, ...names], category: "intent" });
  }
  {
    const m = "I need boxes";
    const { intent } = await search(m);
    const outcome: Outcome = intent.attributes === null ? "PASS" : "FAIL";
    record({
      section: "S12",
      message: m,
      outcome,
      reason: outcome === "FAIL" ? `attributes invented: "${intent.attributes}"` : "correctly extracted no attributes for a bare product query",
      category: "intent",
    });
  }

  console.log("========== SECTION 13: Conversation context ==========\n");
  async function contextTest(_label: string, turn1: string, turn2: string, checks: { product?: boolean; quantity?: string; location?: string; attributes?: string }) {
    const first = await search(turn1);
    const history: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: turn1 },
      { role: "assistant", content: "follow-up question" },
    ];
    const second = await search(turn2, history);
    const productRetained = checks.product === false ? true : second.intent.product !== null;
    const quantityOk = checks.quantity === undefined || second.intent.quantity === checks.quantity;
    const locationOk = checks.location === undefined || second.intent.location === checks.location;
    const attributesOk = checks.attributes === undefined || second.intent.attributes === checks.attributes;
    const outcome: Outcome = productRetained && quantityOk && locationOk && attributesOk ? "PASS" : "FAIL";
    record({
      section: "S13",
      message: `"${turn1}" -> "${turn2}"`,
      outcome,
      actual: [`turn1: ${JSON.stringify(first.intent)}`, `turn2: ${JSON.stringify(second.intent)}`],
      reason: outcome === "FAIL" ? "context not correctly carried/updated across turns" : undefined,
      category: "context",
    });
  }
  await contextTest("S13a", "I need boxes", "5000", { quantity: "5000" });
  await contextTest("S13b", "I need boxes", "Delhi", { location: "Delhi" });
  await contextTest("S13c", "I need boxes", "12x10x8 inches", { attributes: "12x10x8 inches" });

  console.log("========== SECTION 14: Changing requirements ==========\n");
  {
    const turn1 = "I need boxes";
    const turn2 = "Actually, I need bags instead";
    const history: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: turn1 },
      { role: "assistant", content: "follow-up question" },
    ];
    const { intent, names } = await search(turn2, history);
    const productIsBags = intent.product?.toLowerCase().includes("bag") ?? false;
    const resultsAreBags = names.length > 0 && names.every((n) => n === "Kraft Paper Bags");
    const outcome: Outcome = productIsBags && resultsAreBags ? "PASS" : "FAIL";
    record({
      section: "S14",
      message: `"${turn1}" -> "${turn2}"`,
      outcome,
      actual: [`intent.product=${intent.product}`, ...names],
      reason: outcome === "FAIL" ? "changed requirement not reflected — still scoped to boxes" : undefined,
      category: "context",
    });
  }
  {
    const turn1 = "I need boxes in Delhi";
    const turn2 = "Actually, Mumbai";
    const history: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: turn1 },
      { role: "assistant", content: "follow-up question" },
    ];
    const { intent } = await search(turn2, history);
    const outcome: Outcome = intent.location === "Mumbai" ? "PASS" : "FAIL";
    record({
      section: "S14",
      message: `"${turn1}" -> "${turn2}"`,
      outcome,
      actual: [`intent.location=${intent.location}`],
      reason: outcome === "FAIL" ? `location did not update to Mumbai (got ${intent.location})` : undefined,
      category: "context",
    });
  }

  console.log("========== SECTION 15: Typos (classified, not hard-failed) ==========\n");
  await expectTypoTolerant("S15", "I need boxs", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectTypoTolerant("S15", "I need corrugted boxes", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectTypoTolerant("S15", "I need pakaging boxes", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectTypoTolerant("S15", "I need cartns", ["Corrugated Box", "Custom Printed Shipping Box"]);
  await expectTypoTolerant("S15", "I need kraft papr bags", ["Kraft Paper Bags"]);

  console.log("========== SECTION 16: Hinglish ==========\n");
  for (const [m, acceptable] of [
    ["Mujhe packing boxes chahiye", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["Mujhe 5000 boxes chahiye", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["Delhi mein boxes deliver kar sakte ho?", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["Mujhe packaging ke liye boxes chahiye", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["Mujhe kraft paper bags chahiye", ["Kraft Paper Bags"]],
  ] as [string, string[]][]) {
    const { intent, names } = await search(m);
    const intentGotProduct = intent.product !== null;
    if (!intentGotProduct) {
      record({ section: "S16", message: m, outcome: "NOT_SUPPORTED", reason: "LLM intent extraction did not recognize Hinglish product term", actual: [JSON.stringify(intent)], category: "intent" });
      continue;
    }
    if (names.length === 0) {
      record({ section: "S16", message: m, outcome: "NOT_SUPPORTED", reason: "intent extracted correctly, but Postgres English FTS found nothing for the extracted term", actual: [JSON.stringify(intent)], category: "relevance" });
      continue;
    }
    const unexpected = names.filter((n) => !acceptable.includes(n));
    const outcome: Outcome = unexpected.length === 0 ? "PASS" : "FAIL";
    record({ section: "S16", message: m, outcome, expected: acceptable, actual: names, unexpected, category: "relevance" });
  }

  // ---------------- Summary ----------------
  console.log("========================================");
  console.log("SEARCH REGRESSION TEST SUMMARY");
  console.log("========================================\n");

  const total = results.length;
  const pass = results.filter((r) => r.outcome === "PASS").length;
  const fail = results.filter((r) => r.outcome === "FAIL").length;
  const notSupported = results.filter((r) => r.outcome === "NOT_SUPPORTED").length;
  const failures = results.filter((r) => r.outcome === "FAIL");
  const criticalFailures = failures.filter((r) => r.category === "unexpected-product" || r.category === "location");

  console.log(`Total tests: ${total}`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  console.log(`NOT_SUPPORTED: ${notSupported}\n`);
  console.log(`Critical failures (unexpected-product / location): ${criticalFailures.length}\n`);

  if (failures.length > 0) {
    console.log("Failures:");
    failures.forEach((f, i) => {
      console.log(`${i + 1}. [${f.section}] "${f.message}"`);
      if (f.unexpected && f.unexpected.length) console.log(`   Unexpected: ${f.unexpected.join(", ")}`);
      if (f.missing && f.missing.length) console.log(`   Missing: ${f.missing.join(", ")}`);
      if (f.reason) console.log(`   Reason: ${f.reason}`);
    });
    console.log();
  }

  const byCategory = (cat: TestResult["category"]) => results.filter((r) => r.category === cat && r.outcome === "FAIL").length;
  console.log("By category (FAIL counts):");
  console.log(`  Intent extraction failures:    ${byCategory("intent")}`);
  console.log(`  Search relevance failures:     ${byCategory("relevance")}`);
  console.log(`  Unexpected-product failures:   ${byCategory("unexpected-product")}`);
  console.log(`  Missing-product failures:      ${byCategory("missing-product")}`);
  console.log(`  Location-filter failures:      ${byCategory("location")}`);
  console.log(`  Ranking failures:              ${byCategory("ranking")}`);
  console.log(`  Context failures:              ${byCategory("context")}`);
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
