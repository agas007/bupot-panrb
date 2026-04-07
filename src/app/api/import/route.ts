import { NextRequest, NextResponse } from "next/server";
import { parseExcel, mergeExcelData } from "@/lib/excel";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";

export const runtime = 'nodejs';

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
    const reqUsername = req.headers.get("x-simulated-username");
    const adminUser = reqUsername ? await (prisma.colleague as any).findFirst({ where: { username: reqUsername } }) : null;
    
    if (!adminUser || adminUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Access Denied: Administrative role required" }, { status: 403 });
    }

    const formData = await req.formData();
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

    const potonganData = parseExcel(potonganBuffer);
    const sppData = parseExcel(sppBuffer);

    if (potonganData.length === 0) return NextResponse.json({ error: "Potongan file is empty or invalid" }, { status: 400 });
    if (sppData.length === 0) return NextResponse.json({ error: "SPP file is empty or invalid" }, { status: 400 });

    const mergedData = mergeExcelData(potonganData as any, sppData as any);

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
    const userName = req.headers.get("x-simulated-user") || "Admin (Simulated)";
    // @ts-ignore
    await prisma.auditLog.create({
      data: {
        userName,
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
  } catch (error: any) {
    console.error("[Import Error] Global catch:", error);
    return NextResponse.json(
      { error: "Validation Failed: " + error.message },
      { status: 500 }
    );
  }
}
