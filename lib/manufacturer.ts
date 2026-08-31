import { db } from "@/lib/db";
import { manufacturers } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { getSessionManufacturerId } from "@/lib/auth";

/**
 * Strips passwordHash before a manufacturer row is ever serialized into an
 * API response — every route that returns a manufacturer (register, login,
 * GET/PATCH /api/manufacturer) must go through this rather than spreading
 * the row directly into NextResponse.json.
 */
export function toPublicManufacturer<T extends { passwordHash: string | null }>(
  manufacturer: T
): Omit<T, "passwordHash"> {
  const rest: Partial<T> = { ...manufacturer };
  delete rest.passwordHash;
  return rest as Omit<T, "passwordHash">;
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not logged in");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Resolves "the current manufacturer" for a browser request via the login
 * session cookie (lib/auth.ts). Every dashboard page and API route that
 * acts on behalf of the logged-in manufacturer goes through this — throws
 * UnauthenticatedError if there's no valid session, which handleApiError
 * turns into a 401 and page-level auth checks turn into a /login redirect.
 */
export async function getCurrentManufacturer() {
  const manufacturerId = await getSessionManufacturerId();
  if (!manufacturerId) {
    throw new UnauthenticatedError();
  }

  const [manufacturer] = await db.select().from(manufacturers).where(eq(manufacturers.id, manufacturerId));
  if (!manufacturer) {
    throw new UnauthenticatedError();
  }

  return manufacturer;
}

/**
 * Resolves "the manufacturer" for code paths with no browser session to
 * read — the Telegram webhook is called directly by Telegram's servers,
 * never through a logged-in browser. One bot token realistically serves
 * one manufacturer for this MVP, so this keeps the pre-auth behavior of
 * picking the oldest manufacturer row. Only lib/telegram/agent.ts and
 * lib/leads/create-inbound-lead.ts (source: "TELEGRAM") should use this —
 * every browser-facing route should use getCurrentManufacturer() instead.
 */
export async function getManufacturerForBot() {
  const [manufacturer] = await db
    .select()
    .from(manufacturers)
    .orderBy(asc(manufacturers.createdAt))
    .limit(1);

  if (!manufacturer) {
    throw new Error("No manufacturer found. Run `npm run db:seed` to create the demo manufacturer.");
  }

  return manufacturer;
}
