import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight route protection at the edge.
 *
 * This only checks for the presence of the Auth.js session cookie (cheap, no
 * crypto, no DB). The authoritative check happens server-side in
 * `app/dashboard/layout.tsx` via `auth()`. Defense in depth: this gives
 * logged-out users a fast redirect; the layout guards against forged cookies.
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
