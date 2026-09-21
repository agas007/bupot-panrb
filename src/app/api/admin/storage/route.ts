import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/session-cookie";
import { isAdminRole } from "@/lib/roles";
import { checkObjectStorageConnection, runObjectStorageSmokeTest } from "@/lib/object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getAdminUser = async (request: NextRequest) => {
  const username = getRequestSessionUser(request)?.username ?? request.headers.get("x-simulated-username");
  if (!username) return null;

  const user = await prisma.colleague.findUnique({
    where: { username },
    select: { id: true, username: true, role: true },
  });

  return user && isAdminRole(user.role) ? user : null;
};

export async function GET(request: NextRequest) {
  try {
    if (!(await getAdminUser(request))) {
      return NextResponse.json({ error: "Unauthorized access: Administrative level required" }, { status: 403 });
    }

    const storage = await checkObjectStorageConnection();
    if (!storage) return NextResponse.json({ status: "not_configured" }, { status: 503 });

    return NextResponse.json({
      status: storage.ok ? "ok" : "unavailable",
      upstreamStatus: storage.status,
    }, { status: storage.ok ? 200 : 503 });
  } catch (error) {
    console.error("[Admin storage status error]:", error);
    return NextResponse.json({ error: "Failed to check object storage" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await getAdminUser(request))) {
      return NextResponse.json({ error: "Unauthorized access: Administrative level required" }, { status: 403 });
    }

    const result = await runObjectStorageSmokeTest();
    if (!result) return NextResponse.json({ error: "Object storage is not configured" }, { status: 503 });

    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error("[Admin storage smoke test error]:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Object storage smoke test failed" }, { status: 502 });
  }
}
