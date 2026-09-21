import { NextResponse } from "next/server";
import { checkObjectStorageConnection } from "@/lib/object-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const storage = await checkObjectStorageConnection();
    if (!storage) {
      return NextResponse.json(
        { status: "not_configured" },
        { status: 503 },
      );
    }

    if (!storage.ok) {
      return NextResponse.json(
        { status: "unavailable", upstreamStatus: storage.status },
        { status: 503 },
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[Health] Object storage check failed:", error);
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503 },
    );
  }
}
