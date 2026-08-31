import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError } from "@/lib/manufacturer";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: err.issues },
      { status: 422 }
    );
  }

  if (err instanceof UnauthenticatedError) {
    return jsonError("Not logged in", 401);
  }

  if (err instanceof Error) {
    console.error(err);
    return jsonError(err.message, 500);
  }

  console.error(err);
  return jsonError("Unexpected error", 500);
}

export function generateNumber(prefix: string) {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}-${random}`;
}
