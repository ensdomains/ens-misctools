import { NextResponse, type NextRequest } from "next/server";

const PRODUCTION_CSP = "frame-ancestors 'self';";

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  // Only apply CSP in production - dev mode needs to be unrestricted
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Content-Security-Policy", PRODUCTION_CSP);
  }

  return res;
}

export const config = { matcher: "/:path*" };
