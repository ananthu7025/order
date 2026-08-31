import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionManufacturerId } from "@/lib/auth";

const PUBLIC_PATHS = ["/register", "/login"];

/**
 * Gates every dashboard-console page behind a login session. Runs on the
 * Node.js runtime (the Next 16 default for proxy.ts), which is required —
 * getSessionManufacturerId() uses node:crypto to verify the session cookie's
 * signature and won't work on the Edge runtime.
 *
 * API routes are excluded via the matcher below: they already enforce auth
 * themselves through getCurrentManufacturer() (see lib/manufacturer.ts) and
 * must stay reachable without a browser session for cases like the Telegram
 * webhook, which is never sent through a browser at all.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const manufacturerId = await getSessionManufacturerId();
  if (!manufacturerId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|css/).*)"],
};
