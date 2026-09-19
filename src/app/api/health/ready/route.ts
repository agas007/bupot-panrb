import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[Health] Readiness check failed:", error);

    return NextResponse.json(
      { status: "unavailable" },
      { status: 503 },
    );
  }
}
