import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { parseSearchIntent } = await import("../lib/search/intent");
  const { searchProducts } = await import("../lib/search/products");

  const message = "i am looking for a bags to pack my honey related product";
  const intent = await parseSearchIntent(message, []);
  console.log("INTENT:", JSON.stringify(intent, null, 2));
  const results = await searchProducts(intent);
  console.log("RESULTS:", results.map((r) => r.productName));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
