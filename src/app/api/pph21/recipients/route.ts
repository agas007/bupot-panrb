import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPph21User } from "@/lib/pph21-auth";
import { isPph21TaxObjectCode } from "@/lib/pph21";

export const runtime = "nodejs";

type RecipientWithHistory = Prisma.Pph21RecipientGetPayload<{ include: { withholdings: { include: { batch: { include: { record: true } } } } } }>;

export async function GET(req: NextRequest) {
  const user = await getPph21User(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });
  const q = String(req.nextUrl.searchParams.get("q") || "").trim();
  const recipients = await prisma.pph21Recipient.findMany({
    where: q ? { OR: [{ nik: { contains: q } }, { name: { contains: q, mode: "insensitive" } }] } : undefined,
    include: {
      withholdings: {
        include: { batch: { include: { record: true } } },
        orderBy: { batch: { record: { sp2dDate: "desc" } } },
      },
    },
    orderBy: { name: "asc" },
    take: 500,
  }) as RecipientWithHistory[];

  return NextResponse.json(recipients.map((recipient) => {
    const transactions = recipient.withholdings.map((line) => ({
      id: line.id,
      batchId: line.batchId,
      spmNumber: line.batch.record.spmNumber,
      sp2dNumber: line.batch.record.sp2dNumber,
      sp2dDate: line.batch.record.sp2dDate,
      status: line.batch.status,
      taxObjectCode: line.taxObjectCode,
      gross: line.gross,
      calculatedTax: line.calculatedTax,
    }));
    const exported = transactions.filter((item) => item.status === "COMPLETED");
    const monthly = new Map<string, { period: string; count: number; gross: number; tax: number }>();
    transactions.forEach((item) => {
      const period = item.sp2dDate ? item.sp2dDate.toISOString().slice(0, 7) : "Tanpa periode";
      const current = monthly.get(period) || { period, count: 0, gross: 0, tax: 0 };
      current.count += 1;
      current.gross += item.gross;
      current.tax += item.calculatedTax;
      monthly.set(period, current);
    });
    return {
      id: recipient.id,
      nik: recipient.nik,
      name: recipient.name,
      defaultTaxObjectCode: recipient.defaultTaxObjectCode,
      transactionCount: transactions.length,
      totalGross: transactions.reduce((sum, item) => sum + item.gross, 0),
      totalTax: transactions.reduce((sum, item) => sum + item.calculatedTax, 0),
      exportedGross: exported.reduce((sum, item) => sum + item.gross, 0),
      exportedTax: exported.reduce((sum, item) => sum + item.calculatedTax, 0),
      monthlySummary: Array.from(monthly.values()).sort((a, b) => b.period.localeCompare(a.period)),
      transactions,
    };
  }));
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getPph21User(req);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin yang dapat mengubah master penerima" }, { status: 403 });
    const body = await req.json();
    const recipientId = Number(body.id);
    const name = body.name !== undefined ? String(body.name || "").trim() : undefined;
    const nik = body.nik !== undefined ? String(body.nik || "").replace(/\D/g, "") : undefined;
    const code = body.defaultTaxObjectCode !== undefined ? String(body.defaultTaxObjectCode || "") : undefined;
    if (name !== undefined && !name) return NextResponse.json({ error: "Nama wajib valid" }, { status: 400 });
    if (nik !== undefined && !/^\d{16}$/.test(nik)) return NextResponse.json({ error: "NIK wajib 16 digit" }, { status: 400 });
    if (code !== undefined && !isPph21TaxObjectCode(code)) return NextResponse.json({ error: "Kode objek pajak wajib valid" }, { status: 400 });
    const existing = await prisma.pph21Recipient.findUnique({ where: { id: recipientId } });
    if (!existing) return NextResponse.json({ error: "Penerima tidak ditemukan" }, { status: 404 });
    if (nik !== undefined && nik !== existing.nik) {
      const duplicate = await prisma.pph21Recipient.findUnique({ where: { nik } });
      if (duplicate && duplicate.id !== recipientId) return NextResponse.json({ error: "NIK sudah dipakai penerima lain" }, { status: 400 });
    }
    const recipient = await prisma.pph21Recipient.update({
      where: { id: recipientId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(nik !== undefined ? { nik } : {}),
        ...(code !== undefined ? { defaultTaxObjectCode: code } : {}),
      },
    });
    await prisma.auditLog.create({ data: { userName: user.name, action: "Updated PPh 21 Recipient", target: `${recipient.nik} - ${recipient.name}`, category: "DATA", type: "success" } });
    return NextResponse.json(recipient);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui penerima" }, { status: 400 });
  }
}
