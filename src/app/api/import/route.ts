import { NextRequest, NextResponse } from "next/server";
import { parseExcel, mergeExcelData, type PotonganRow, type SPP_SPM_SP2D_Row } from "@/lib/excel";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";
import { getRequestSessionUser } from "@/lib/session-cookie";
import { isAdminRole, normalizeUserRoles } from "@/lib/roles";

export const runtime = 'nodejs';

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

/**
 * Handle POST: Bulk import records from Excel with optional preview mode
 */
export async function POST(req: NextRequest) {
  try {
    // 0. Rate Limit Check
    const rateLimit = await applyRateLimit(req, 10, 60 * 1000); // 10 imports/min
    if (rateLimit) return rateLimit;

    const { searchParams } = new URL(req.url);
    const isPreview = searchParams.get("preview") === "true";

    // 1. Administrative Security Check
    const sessionUser = getRequestSessionUser(req);
    const reqUsername = sessionUser?.username ?? req.headers.get("x-simulated-username");
    const sessionRoles = normalizeUserRoles(sessionUser?.roles ?? sessionUser?.role);
    const simulatedRoles = normalizeUserRoles(req.headers.get("x-simulated-roles") ?? req.headers.get("x-simulated-role"));
    const effectiveRoles = sessionRoles.length > 0 ? sessionRoles : simulatedRoles;

    if (!reqUsername) {
      return NextResponse.json({ error: "Access Denied: Missing authenticated user" }, { status: 401 });
    }

    const adminUser = effectiveRoles.length > 0
      ? null
      : await withTimeout(
          prisma.colleague.findFirst({ where: { username: reqUsername } }),
          10000,
          "Administrative lookup timed out"
        );

    const hasAdminAccess = effectiveRoles.length > 0
      ? isAdminRole(effectiveRoles)
      : adminUser?.role === "ADMIN";

    if (!hasAdminAccess) {
      return NextResponse.json({ error: "Access Denied: Administrative role required" }, { status: 403 });
    }

    const formData = await withTimeout(req.formData(), 15000, "Upload parsing timed out");
    const potonganFile = formData.get("potongan") as File;
    const sppFile = formData.get("spp") as File;

    if (!potonganFile || !sppFile) {
      return NextResponse.json(
        { error: "Both Potongan and SPP files are required" },
        { status: 400 }
      );
    }

    // Validation stage
    if (!potonganFile.name.endsWith('.xlsx') && !potonganFile.name.endsWith('.csv')) {
      return NextResponse.json({ error: "Potongan file must be .xlsx or .csv" }, { status: 400 });
    }
    if (!sppFile.name.endsWith('.xlsx') && !sppFile.name.endsWith('.csv')) {
      return NextResponse.json({ error: "SPP file must be .xlsx or .csv" }, { status: 400 });
    }

    const potonganBuffer = Buffer.from(await potonganFile.arrayBuffer());
    const sppBuffer = Buffer.from(await sppFile.arrayBuffer());

    const potonganData = parseExcel(potonganBuffer) as PotonganRow[];
    const sppData = parseExcel(sppBuffer) as SPP_SPM_SP2D_Row[];

    if (potonganData.length === 0) return NextResponse.json({ error: "Potongan file is empty or invalid" }, { status: 400 });
    if (sppData.length === 0) return NextResponse.json({ error: "SPP file is empty or invalid" }, { status: 400 });

    const mergedData = mergeExcelData(potonganData, sppData);

    if (isPreview) {
      return NextResponse.json({
        success: true,
        count: mergedData.length,
        preview: mergedData.slice(0, 100), // Preview only first 100 items
        isPartial: mergedData.length > 100
      });
    }

    console.log(`[Import Log] Starting import for ${mergedData.length} records...`);

    // Batching to prevent DB connection exhaustion
    const CHUNK_SIZE = 50; 
    let resultsCount = 0;

    for (let i = 0; i < mergedData.length; i += CHUNK_SIZE) {
      const chunk = mergedData.slice(i, i + CHUNK_SIZE);
      
      const chunkResults = await prisma.$transaction(
        chunk.map((data) =>
          prisma.sPMRecord.upsert({
            where: { uniqueKey: data.uniqueKey },
            update: {
              spmDate: data.spmDate,
              sp2dNumber: data.sp2dNumber,
              sp2dDate: data.sp2dDate,
              description: data.description,
              recipient: data.recipient,
              totalValue: data.totalValue,
              deductionAmount: data.deductionAmount,
            },
            create: {
              ...data,
              status: "PENDING",
            },
          })
        )
      );
      resultsCount += chunkResults.length;
    }

    // Audit trail
    const auditSessionUser = getRequestSessionUser(req);
    const userName = auditSessionUser?.name || req.headers.get("x-simulated-user") || "Admin (Simulated)";
    await prisma.auditLog.create({
      data: {
        userName,
        username: auditSessionUser?.username || req.headers.get("x-simulated-username") || userName,
        action: "Bulk Imported Data",
        target: `${resultsCount} Records`,
        category: "DATA",
        type: "success",
      },
    });

    return NextResponse.json({
      success: true,
      count: resultsCount,
    });
  } catch (error: unknown) {
    console.error("[Import Error] Global catch:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Validation Failed: " + message },
      { status: 500 }
    );
  }
}
