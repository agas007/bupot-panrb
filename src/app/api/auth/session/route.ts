import { NextRequest, NextResponse } from "next/server";
import { parseCookieSessionValue, SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = parseCookieSessionValue(cookie);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(session.user);
}
