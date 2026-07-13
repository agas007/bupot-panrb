import { NextResponse, type NextRequest } from "next/server";

const LEGACY_HOSTS = new Set(["bupot-panrb.vercel.app"]);
const REDIRECT_TARGET_URL = process.env.LEGACY_REDIRECT_TARGET_URL?.trim();

export function proxy(request: NextRequest) {
  if (!REDIRECT_TARGET_URL) {
    return NextResponse.next();
  }

  if (!LEGACY_HOSTS.has(request.nextUrl.hostname)) {
    return NextResponse.next();
  }

  const target = new URL(REDIRECT_TARGET_URL);
  target.pathname = request.nextUrl.pathname;
  target.search = request.nextUrl.search;

  return NextResponse.redirect(target, 308);
}
