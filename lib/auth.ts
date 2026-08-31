import { randomBytes, scrypt, timingSafeEqual, createHmac } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";

const scryptAsync = promisify(scrypt);

const SESSION_COOKIE = "moqpool_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SCRYPT_KEY_LENGTH = 64;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Add it to .env.local.");
  }
  return secret;
}

/**
 * Password hashing via Node's built-in scrypt rather than bcrypt/argon2 —
 * no native module to compile, no extra dependency, and scrypt is a
 * perfectly fine memory-hard KDF for this use case. Stored as
 * "salt:derivedKeyHex" so verifyPassword doesn't need a separate column.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = (await scryptAsync(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;

  if (derivedKey.length !== keyBuffer.length) return false;
  return timingSafeEqual(derivedKey, keyBuffer);
}

type SessionPayload = { manufacturerId: string; issuedAt: number };

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

/**
 * Sessions are a signed cookie, not a DB-backed session table: the payload
 * (manufacturer id + issued-at) is base64url-encoded and HMAC-signed, so the
 * server can verify it wasn't tampered with without a lookup. Simplest
 * option that still supports real logout (clearing the cookie) and
 * expiry — this MVP doesn't need server-side session revocation.
 */
function encodeSession(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const json = Buffer.from(body, "base64url").toString("utf8");
    const payload = JSON.parse(json) as SessionPayload;
    if (typeof payload.manufacturerId !== "string" || typeof payload.issuedAt !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(manufacturerId: string): Promise<void> {
  const token = encodeSession({ manufacturerId, issuedAt: Date.now() });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Returns the logged-in manufacturer's id, or null if there's no valid session. */
export async function getSessionManufacturerId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = decodeSession(token);
  if (!payload) return null;

  const age = Date.now() - payload.issuedAt;
  if (age > SESSION_MAX_AGE_SECONDS * 1000) return null;

  return payload.manufacturerId;
}
