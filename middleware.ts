import { NextResponse, type NextRequest } from "next/server";

const CSP = "frame-ancestors 'self';";

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  // Skip CSP only in local development
  if (process.env.NODE_ENV !== "development") {
    res.headers.set("Content-Security-Policy", CSP);
  }

  return res;
}

export const config = { matcher: "/:path*" };
