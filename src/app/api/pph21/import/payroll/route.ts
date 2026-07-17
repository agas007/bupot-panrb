import { NextRequest, NextResponse } from "next/server";
import { getPph21User } from "@/lib/pph21-auth";
import { parseMmPayrollXml } from "@/lib/pph21";

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

    const lines = parseMmPayrollXml(await file.text());
    const totalGross = lines.reduce((sum, line) => sum + line.gross, 0);
    const totalTax = lines.reduce((sum, line) => sum + line.calculatedTax, 0);
    const uniqueRecipients = new Set(lines.map((line) => line.counterpartTin)).size;
    const first = lines[0];

    return NextResponse.json({
      fileName: file.name,
      totalRows: lines.length,
      uniqueRecipients,
      totalGross,
      totalTax,
      taxPeriodMonth: first?.taxPeriodMonth ?? null,
      taxPeriodYear: first?.taxPeriodYear ?? null,
      withholdingDate: first?.withholdingDate ?? null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memeriksa XML Non-Final" }, { status: 400 });
  }
}
