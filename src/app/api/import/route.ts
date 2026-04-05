import { NextRequest, NextResponse } from "next/server";
import { parseExcel, mergeExcelData } from "@/lib/excel";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
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

    // Batch upsert to database
    // We use a transaction to ensure atomic updates
    const results = await prisma.$transaction(
      mergedData.map((data) =>
        prisma.sPMRecord.upsert({
          where: { uniqueKey: data.uniqueKey },
          update: {
            // Only update fields that come from the Excel
            spmDate: data.spmDate,
            sp2dNumber: data.sp2dNumber,
            sp2dDate: data.sp2dDate,
            description: data.description,
            recipient: data.recipient,
            totalValue: data.totalValue,
            // We DO NOT update status or assignee here to preserve manual work
          },
          create: {
            ...data,
            status: "PENDING",
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: results.length,
    });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to process files: " + error.message },
      { status: 500 }
    );
  }
}
