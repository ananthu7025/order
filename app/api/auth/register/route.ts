import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { manufacturers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSession } from "@/lib/auth";
import { toPublicManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError } from "@/lib/api-helpers";

const registerSchema = z.object({
  // Basic Information
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  mobile: z.string().min(6, "Enter a valid mobile number"),
  countryCode: z.string().default("+91"),
  password: z.string().min(8, "Password must be at least 8 characters"),

  // Business Details
  companyName: z.string().min(1, "Company name is required"),
  businessType: z.string().min(1, "Business type is required"),
  gstin: z.string().optional(),
  registrationNumber: z.string().optional(),
  yearOfEstablishment: z.string().min(1, "Year of establishment is required"),
  numberOfEmployees: z.string().min(1, "Number of employees is required"),
  registeredAddress: z.string().min(1, "Registered address is required"),

  // Verification
  panNumber: z.string().min(1, "PAN number is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const [existing] = await db.select({ id: manufacturers.id }).from(manufacturers).where(eq(manufacturers.email, data.email));
    if (existing) {
      return jsonError("An account with this email already exists", 409);
    }

    const passwordHash = await hashPassword(data.password);

    const [manufacturer] = await db
      .insert(manufacturers)
      .values({
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        mobile: `${data.countryCode} ${data.mobile}`.trim(),
        companyName: data.companyName,
        businessType: data.businessType,
        gstin: data.gstin || undefined,
        registrationNumber: data.registrationNumber || undefined,
        yearEstablished: data.yearOfEstablishment,
        numberOfEmployees: data.numberOfEmployees,
        businessLocation: data.registeredAddress,
        panNumber: data.panNumber,
        verificationStatus: "PENDING_REVIEW",
      })
      .returning();

    await createSession(manufacturer.id);

    return NextResponse.json({ manufacturer: toPublicManufacturer(manufacturer) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
