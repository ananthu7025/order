import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { parseSearchIntent } = await import("../lib/search/intent");
  const { searchProducts } = await import("../lib/search/products");

  const cases: [string, string[]][] = [
    ["I am looking for a bags to pack my honey related product", ["Kraft Paper Bags"]],
    ["I need bags for honey", ["Kraft Paper Bags"]],
    ["I need bags to pack honey", ["Kraft Paper Bags"]],
    ["I need bags for my products", ["Kraft Paper Bags"]],
    ["I need bags for ecommerce", ["Kraft Paper Bags"]],
    ["I need packaging bags for food", ["Kraft Paper Bags"]],
    ["I need boxes to pack products", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["I need cartons to ship products", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["I need boxes to pack my products", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["I need boxes for my ecommerce business", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["I need boxes for my food business", ["Corrugated Box", "Custom Printed Shipping Box"]],
    ["I need something for my honey business", []],
    ["I need something to pack my products", []],
  ];

  for (const [message, expected] of cases) {
    const intent = await parseSearchIntent(message, []);
    const results = await searchProducts(intent);
    const names = results.map((r) => r.productName);
    const missing = expected.filter((e) => !names.includes(e));
    const unexpected = names.filter((n) => !expected.includes(n));
    const pass = missing.length === 0 && unexpected.length === 0;
    console.log(`${pass ? "PASS" : "FAIL"} | "${message}"`);
    console.log(`  intent: ${JSON.stringify(intent)}`);
    console.log(`  expected: ${expected.join(", ") || "(none)"}`);
    console.log(`  actual:   ${names.join(", ") || "(none)"}`);
    if (missing.length) console.log(`  MISSING: ${missing.join(", ")}`);
    if (unexpected.length) console.log(`  UNEXPECTED: ${unexpected.join(", ")}`);
    console.log();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
