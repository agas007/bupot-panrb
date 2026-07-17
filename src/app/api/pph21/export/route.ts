import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPph21ExportFileName, buildPph21Xml, PPH21_ACCOUNT_CODE } from "@/lib/pph21";
import { canManagePph21, getPph21User } from "@/lib/pph21-auth";

export const runtime = "nodejs";

type ExportRecord = Prisma.SPMRecordGetPayload<{ include: { pph21Batch: { include: { withholdings: { include: { recipient: true } } } } } }>;

export async function POST(req: NextRequest) {
  try {
    const user = await getPph21User(req);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });
    const body = await req.json();
    const recordIds: number[] = Array.from(new Set<number>((Array.isArray(body.recordIds) ? body.recordIds : []).map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value))));
    if (recordIds.length === 0) return NextResponse.json({ error: "Pilih minimal satu SP2D" }, { status: 400 });

    const records = await prisma.sPMRecord.findMany({
      where: { id: { in: recordIds } },
      include: { pph21Batch: { include: { withholdings: { include: { recipient: true }, orderBy: { id: "asc" } } } } },
      orderBy: [{ sp2dDate: "asc" }, { sp2dNumber: "asc" }],
    }) as ExportRecord[];
    if (records.length !== recordIds.length) throw new Error("Sebagian record tidak ditemukan.");

    const batches = records.map((record) => {
      if (record.accountCode !== PPH21_ACCOUNT_CODE) throw new Error(`${record.spmNumber} bukan PPh 21.`);
      if (!canManagePph21(user, record)) throw new Error(`Tidak berhak mengekspor ${record.spmNumber}.`);
      if (!record.sp2dNumber || !record.sp2dDate) throw new Error(`${record.spmNumber} belum memiliki nomor/tanggal SP2D.`);
      const batch = record.pph21Batch;
      if (!batch?.withholdingDate || batch.withholdings.length === 0) throw new Error(`Rincian ${record.sp2dNumber} belum lengkap.`);
      if (batch.status === "ISSUES") throw new Error(`${record.sp2dNumber} masih berstatus ISSUES.`);
      const totalTax = batch.withholdings.reduce((sum, line) => sum + line.calculatedTax, 0);
      if (totalTax !== record.deductionAmount) throw new Error(`Total pajak ${record.sp2dNumber} (${totalTax}) tidak sama dengan potongan (${record.deductionAmount}).`);
      return { ...batch, withholdingDate: batch.withholdingDate, record: { sp2dNumber: record.sp2dNumber, sp2dDate: record.sp2dDate } };
    });

    const xml = buildPph21Xml(batches);
    const fileName = buildPph21ExportFileName(records.map((record) => ({ spmNumber: record.spmNumber, sp2dNumber: record.sp2dNumber })), user.name);
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const exportLog = await tx.pph21Export.create({ data: { fileName, exportedById: user.id } });
      await tx.pph21ExportItem.createMany({ data: batches.map((batch) => ({ exportId: exportLog.id, batchId: batch.id })) });
      await tx.pph21Batch.updateMany({ where: { id: { in: batches.map((batch) => batch.id) } }, data: { status: "COMPLETED", issueNotes: null } });
      await tx.auditLog.create({ data: { userName: user.name, action: "Exported PPh 21 XML", target: `${records.length} SP2D - ${fileName}`, category: "DATA", type: "success" } });
    });

    return new NextResponse(xml, {
      status: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"`, "X-Export-Filename": fileName },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat XML" }, { status: 400 });
  }
}
