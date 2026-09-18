import { NextResponse, type NextRequest } from "next/server";

const LEGACY_HOSTS = new Set(["bupot-panrb.vercel.app"]);
const REDIRECT_TARGET_URL = process.env.LEGACY_REDIRECT_TARGET_URL?.trim();
const READ_ONLY_MODE = process.env.BUPOT_READ_ONLY === "true";
const READ_ONLY_ALLOWED_MUTATIONS = new Set([
  "/api/auth/login",
  "/api/auth/logout",
]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  if (
    READ_ONLY_MODE &&
    request.nextUrl.pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(request.method) &&
    !READ_ONLY_ALLOWED_MUTATIONS.has(request.nextUrl.pathname)
  ) {
    return NextResponse.json(
      {
        error: "Aplikasi lama sedang dalam mode read-only. Silakan gunakan bupot.menpan.go.id untuk transaksi.",
      },
      { status: 423 },
    );
  }

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
