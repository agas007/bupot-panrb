import { NextRequest, NextResponse } from "next/server";
import { parseExcel, mergeExcelData } from "@/lib/excel";
import { prisma } from "@/lib/prisma";

/**
 * @swagger
 * /api/import:
 *   post:
 *     summary: Bulk import records from Excel
 *     description: Upload Potongan and SPP files to merge and import records into the system.
 *     tags: [Management]
 *     security:
 *       - SimulatorUser: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               potongan: { type: string, format: binary }
 *               spp: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Data imported successfully.
 */
export async function POST(req: NextRequest) {
  try {
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

    const potonganBuffer = Buffer.from(await potonganFile.arrayBuffer());
    const sppBuffer = Buffer.from(await sppFile.arrayBuffer());

    const potonganData = parseExcel(potonganBuffer);
    const sppData = parseExcel(sppBuffer);

    const mergedData = mergeExcelData(potonganData as any, sppData as any);

    console.log(`[Import Log] Starting import for ${mergedData.length} records...`);

    // Splitting into smaller chunks (batches) to avoid DB timeouts & connection limits
    const CHUNK_SIZE = 50; 
    let resultsCount = 0;

    for (let i = 0; i < mergedData.length; i += CHUNK_SIZE) {
      const chunk = mergedData.slice(i, i + CHUNK_SIZE);
      console.log(`[Import Log] Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} items)...`);
      
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

    console.log(`[Import Log] Import complete! Total: ${resultsCount} records.`);

    // Add Audit Log
    const userName = req.headers.get("x-simulated-user") || "Admin (Simulated)";
    // @ts-ignore - Prisma types might be lagging after schema update
    await prisma.auditLog.create({
      data: {
        userName,
        action: "Bulk Imported Data",
        target: `${resultsCount} Records from Excel`,
        type: "system",
      },
    });

    return NextResponse.json({
      success: true,
      count: resultsCount,
    });
  } catch (error: any) {
    console.error("[Import Error] Global catch:", error);
    return NextResponse.json(
      { error: "Failed to process files: " + error.message },
      { status: 500 }
    );
  }
}
