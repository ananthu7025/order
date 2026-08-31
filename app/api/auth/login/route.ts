import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { manufacturers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession } from "@/lib/auth";
import { toPublicManufacturer } from "@/lib/manufacturer";
import { handleApiError, jsonError } from "@/lib/api-helpers";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const [manufacturer] = await db.select().from(manufacturers).where(eq(manufacturers.email, email));

    // Same error for "no such account" and "wrong password" — don't leak
    // which one it was.
    if (!manufacturer || !manufacturer.passwordHash) {
      return jsonError("Invalid email or password", 401);
    }

    const valid = await verifyPassword(password, manufacturer.passwordHash);
    if (!valid) {
      return jsonError("Invalid email or password", 401);
    }

    await createSession(manufacturer.id);

    return NextResponse.json({ manufacturer: toPublicManufacturer(manufacturer) });
  } catch (err) {
    return handleApiError(err);
  }
}
