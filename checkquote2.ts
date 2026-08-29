import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("./lib/db/index");
  const { quotations, quotationLineItems } = await import("./lib/db/schema");
  const rows = await db.select().from(quotations);
  const items = await db.select().from(quotationLineItems);
  console.log("QUOTATIONS:", JSON.stringify(rows, null, 2));
  console.log("LINE ITEMS:", JSON.stringify(items, null, 2));
}
main().then(() => process.exit(0));
