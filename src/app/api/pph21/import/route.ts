import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManagePph21, getPph21User } from "@/lib/pph21-auth";
import { parsePph21Xml, PPH21_ACCOUNT_CODE } from "@/lib/pph21";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getPph21User(req);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });
    const formData = await req.formData();
    const file = formData.get("xml");
    if (!(file instanceof File)) return NextResponse.json({ error: "File XML wajib dipilih" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xml")) return NextResponse.json({ error: "File harus berekstensi .xml" }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Ukuran XML maksimal 2 MB" }, { status: 400 });

    const lines = parsePph21Xml(await file.text());
    const documentNumbers = Array.from(new Set(lines.map((line) => line.documentNumber)));
    const records = await prisma.sPMRecord.findMany({
      where: { accountCode: PPH21_ACCOUNT_CODE, sp2dNumber: { in: documentNumbers } },
      include: { pph21Batch: { include: { _count: { select: { withholdings: true } } } } },
    });
    const recordsBySp2d = new Map(records.map((record: { sp2dNumber: string | null }) => [record.sp2dNumber, record]));
    const groups = documentNumbers.map((documentNumber) => {
      const documentLines = lines.filter((line) => line.documentNumber === documentNumber);
      const xmlTax = documentLines.reduce((sum, line) => sum + line.calculatedTax, 0);
      const record = recordsBySp2d.get(documentNumber) as { id: number; spmNumber: string; sp2dNumber: string | null; sp2dDate: Date | null; deductionAmount: number; assigneeId: number | null; pph21Batch: null | { id: number; _count: { withholdings: number } } } | undefined;
      const difference = record ? xmlTax - record.deductionAmount : null;
      const dates = Array.from(new Set(documentLines.map((line) => line.withholdingDate)));
      const status = !record ? "NOT_FOUND" : difference !== 0 ? "MISMATCH" : !canManagePph21(user, record) ? "FORBIDDEN" : record.pph21Batch?._count.withholdings ? "ALREADY_FILLED" : dates.length !== 1 ? "INVALID_DATES" : "READY_TO_IMPORT";
      return {
        documentNumber,
        recordId: record?.id ?? null,
        spmNumber: record?.spmNumber ?? null,
        sp2dDate: record?.sp2dDate ?? null,
        recipientCount: documentLines.length,
        xmlGross: documentLines.reduce((sum, line) => sum + line.gross, 0),
        xmlTax,
        sp2dDeduction: record?.deductionAmount ?? null,
        difference,
        status,
        withholdingDate: dates.length === 1 ? dates[0] : null,
        lines: documentLines,
      };
    });

    for (const group of groups) {
      if (group.status !== "READY_TO_IMPORT" || !group.recordId || !group.withholdingDate) continue;
      const recordId = group.recordId;
      const withholdingDate = group.withholdingDate;
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existingCount = await tx.pph21Withholding.count({ where: { batch: { recordId } } });
        if (existingCount > 0) {
          group.status = "ALREADY_FILLED";
          return;
        }
        const batch = await tx.pph21Batch.upsert({
          where: { recordId },
          create: { recordId, withholdingDate: new Date(withholdingDate), status: "DATA_ENTERED" },
          update: { withholdingDate: new Date(withholdingDate), status: "DATA_ENTERED", issueNotes: null },
        });
        const uniqueRecipients = Array.from(new Map(group.lines.map((line) => [line.counterpartTin, line])).values());
        const existingRecipients = await tx.pph21Recipient.findMany({ where: { nik: { in: uniqueRecipients.map((line) => line.counterpartTin) } } });
        const existingByNik = new Map(existingRecipients.map((recipient) => [recipient.nik, recipient]));
        const missingRecipients = uniqueRecipients
          .filter((line) => !existingByNik.has(line.counterpartTin))
          .map((line) => ({ nik: line.counterpartTin, name: `NIK ${line.counterpartTin}`, defaultTaxObjectCode: line.taxObjectCode }));
        if (missingRecipients.length > 0) {
          await tx.pph21Recipient.createMany({ data: missingRecipients, skipDuplicates: true });
        }
        const recipients = await tx.pph21Recipient.findMany({ where: { nik: { in: uniqueRecipients.map((line) => line.counterpartTin) } } });
        const recipientsByNik = new Map(recipients.map((recipient) => [recipient.nik, recipient]));
        await tx.pph21Withholding.createMany({
          data: group.lines.map((line) => {
            const recipient = recipientsByNik.get(line.counterpartTin);
            if (!recipient) throw new Error(`Penerima ${line.counterpartTin} gagal disimpan.`);
            return { batchId: batch.id, recipientId: recipient.id, recipientName: recipient.name, taxObjectCode: line.taxObjectCode, gross: line.gross, deemed: line.deemed, rate: line.rate, calculatedTax: line.calculatedTax };
          }),
        });
        await tx.sPMRecord.update({
          where: { id: recordId },
          data: { status: "COMPLETED", completionDate: new Date() },
        });
        group.status = "IMPORTED";
      }, { maxWait: 10_000, timeout: 20_000 });
    }
    await prisma.auditLog.create({ data: { userName: user.name, username: user.username, action: "Imported and Checked PPh 21 XML", target: `${file.name} - ${groups.length} SP2D`, category: "DATA", type: groups.every((group) => group.status === "IMPORTED" || group.status === "ALREADY_FILLED") ? "success" : "warning" } });
    return NextResponse.json({
      fileName: file.name,
      totalRows: lines.length,
      totalDocuments: groups.length,
      importedCount: groups.filter((group) => group.status === "IMPORTED").length,
      matchCount: groups.filter((group) => group.status === "IMPORTED" || group.status === "ALREADY_FILLED").length,
      mismatchCount: groups.filter((group) => group.status === "MISMATCH").length,
      notFoundCount: groups.filter((group) => group.status === "NOT_FOUND").length,
      groups,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memeriksa XML" }, { status: 400 });
  }
}
