import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("./index");
  const { manufacturers } = await import("./schema");

  const existing = await db.select().from(manufacturers).limit(1);

  if (existing.length > 0) {
    console.log(`Manufacturer already exists (${existing[0].companyName}), skipping seed.`);
    return;
  }

  const [manufacturer] = await db
    .insert(manufacturers)
    .values({
      companyName: "PackRight Industries",
      businessType: "Manufacturer",
      aboutCompany:
        "PackRight Industries has been manufacturing packaging materials for 8 years, serving businesses across India with corrugated boxes, paper bags, and courier bags.",
      yearEstablished: "2018",
      gstin: "07AAAPL1234C1ZV",
      website: "",
      phone: "+91 98450 00000",
      whatsappNumber: "+91 98450 00000",
      businessLocation: "Delhi, India",
      manufacturingLocations: "Delhi, Faridabad",
      categories: ["Packaging Materials", "Corrugated Boxes"],
    })
    .returning();

  console.log(`Seeded manufacturer: ${manufacturer.companyName} (${manufacturer.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
