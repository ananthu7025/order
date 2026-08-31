import { config } from "dotenv";
config({ path: ".env.local" });

// Fixed demo credentials so local dev/testing always has a working login
// without registering a fresh account every time. Not a secret worth
// protecting — this is sample data for an MVP, not a real tenant.
const DEMO_EMAIL = "demo@packright.test";
const DEMO_PASSWORD = "Demo@12345";

async function main() {
  const { db } = await import("./index");
  const { manufacturers } = await import("./schema");
  const { hashPassword } = await import("../auth");

  const existing = await db.select().from(manufacturers).limit(1);

  if (existing.length > 0) {
    console.log(`Manufacturer already exists (${existing[0].companyName}), skipping seed.`);
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [manufacturer] = await db
    .insert(manufacturers)
    .values({
      fullName: "Demo Owner",
      email: DEMO_EMAIL,
      passwordHash,
      mobile: "+91 98450 00000",
      companyName: "PackRight Industries",
      businessType: "Manufacturer",
      aboutCompany:
        "PackRight Industries has been manufacturing packaging materials for 8 years, serving businesses across India with corrugated boxes, paper bags, and courier bags.",
      yearEstablished: "2018",
      numberOfEmployees: "11 - 50",
      gstin: "07AAAPL1234C1ZV",
      website: "",
      phone: "+91 98450 00000",
      whatsappNumber: "+91 98450 00000",
      businessLocation: "Delhi, India",
      manufacturingLocations: "Delhi, Faridabad",
      categories: ["Packaging Materials", "Corrugated Boxes"],
      verificationStatus: "VERIFIED",
    })
    .returning();

  console.log(`Seeded manufacturer: ${manufacturer.companyName} (${manufacturer.id})`);
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
