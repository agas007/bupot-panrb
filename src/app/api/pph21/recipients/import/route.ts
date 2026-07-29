import * as XLSX from "xlsx";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPph21User } from "@/lib/pph21-auth";
import { normalizePtkpStatus, PPH21_PTKP_STATUSES } from "@/lib/pph21";
import { ensurePph21RecipientPtkpTable } from "@/lib/pph21-ptkp";

export const runtime = "nodejs";

const PTKP_STATUS_SET = new Set(PPH21_PTKP_STATUSES);

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeHeader(value: unknown) {
  return normalizeText(value).toUpperCase().replace(/\s+/g, " ");
}

function parseTaxYear(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return year;
}

type ImportedRow = {
  nik: string;
  name: string;
  statusPtkp: string;
  taxYear: number;
  category: string;
  sourceData: string;
  note: string;
  rowNumber: number;
};

type RowResult = ImportedRow & {
  status: "VALID" | "DUPLICATE" | "INVALID";
  message?: string;
};

function findHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === "NIK") && row.some((cell) => normalizeHeader(cell) === "STATUS PTKP"));
}

function resolveColumns(headerRow: unknown[]) {
  const columns = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (header) columns.set(header, index);
  });
  return {
    nik: columns.get("NIK"),
    name: columns.get("NAMA"),
    statusPtkp: columns.get("STATUS PTKP"),
    taxYear: columns.get("TAHUN PAJAK"),
    category: columns.get("KATEGORI PENERIMA"),
    sourceData: columns.get("SUMBER DATA"),
    note: columns.get("CATATAN"),
  };
}

function parseTemplateRows(rows: unknown[][]) {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) throw new Error('Sheet "Master PTKP" tidak memiliki baris header.');
  const headerRow = rows[headerIndex];
  const columns = resolveColumns(headerRow);
  if (columns.nik === undefined || columns.name === undefined || columns.statusPtkp === undefined || columns.taxYear === undefined) {
    throw new Error("Kolom wajib NIK, Nama, Status PTKP, dan Tahun Pajak tidak lengkap.");
  }

  const dataRows: ImportedRow[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const nik = normalizeText(row[columns.nik]);
    const name = normalizeText(row[columns.name]);
    const statusPtkp = normalizeText(row[columns.statusPtkp]).toUpperCase().replace(/\s+/g, "");
    const taxYear = parseTaxYear(row[columns.taxYear]);
    const category = columns.category === undefined ? "" : normalizeText(row[columns.category]);
    const sourceData = columns.sourceData === undefined ? "" : normalizeText(row[columns.sourceData]);
    const note = columns.note === undefined ? "" : normalizeText(row[columns.note]);
    if (!nik && !name && !statusPtkp && !taxYear && !category && !sourceData && !note) continue;
    dataRows.push({
      nik,
      name,
      statusPtkp,
      taxYear: taxYear ?? 0,
      category,
      sourceData,
      note,
      rowNumber: rowIndex + 1,
    });
  }
  return dataRows;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getPph21User(req);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin yang dapat mengimpor master PTKP" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File Excel wajib dipilih" }, { status: 400 });
    if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "File harus berekstensi .xlsx" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Ukuran file maksimal 5 MB" }, { status: 400 });

    const previewOnly = new URL(req.url).searchParams.get("preview") === "true";
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets["Master PTKP"];
    if (!sheet) return NextResponse.json({ error: 'Sheet "Master PTKP" tidak ditemukan' }, { status: 400 });

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
    const parsedRows = parseTemplateRows(rows);
    if (parsedRows.length === 0) return NextResponse.json({ error: "Tidak ada baris data PTKP yang ditemukan" }, { status: 400 });
    await ensurePph21RecipientPtkpTable();

    const seenKeys = new Set<string>();
    const validRows = parsedRows.map<RowResult>((row) => {
      const nik = row.nik.replace(/\D/g, "");
      const status = normalizePtkpStatus(row.statusPtkp);
      const isValid = /^\d{16}$/.test(nik) && row.name && status && row.taxYear && PTKP_STATUS_SET.has(status);
      if (!isValid) {
        return {
          ...row,
          nik,
          statusPtkp: status || row.statusPtkp,
          status: "INVALID",
          message: !/^\d{16}$/.test(nik)
            ? "NIK harus 16 digit"
            : !row.name
              ? "Nama wajib diisi"
              : !status
                ? "Status PTKP tidak valid"
                : !row.taxYear
                  ? "Tahun pajak wajib diisi"
                  : "Baris tidak valid",
        };
      }
      return { ...row, nik, statusPtkp: status, status: "VALID" };
    });

    const results: RowResult[] = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    const uniqueValidRows = validRows.filter((row) => row.status === "VALID").filter((row) => {
      const key = `${row.nik}-${row.taxYear}`;
      if (seenKeys.has(key)) {
        results.push({ ...row, status: "DUPLICATE", message: "Duplikat di file yang sama" });
        duplicateCount += 1;
        return false;
      }
      seenKeys.add(key);
      return true;
    });

    const existing = previewOnly
      ? []
      : await prisma.pph21RecipientPtkp.findMany({
          where: {
            OR: uniqueValidRows.length
              ? uniqueValidRows.map((row) => ({ nik: row.nik, taxYear: row.taxYear }))
              : [{ nik: "", taxYear: -1 }],
          },
        });
    const existingByKey = new Set(existing.map((row) => `${row.nik}-${row.taxYear}`));

    if (!previewOnly && uniqueValidRows.length > 0) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const row of uniqueValidRows) {
          const key = `${row.nik}-${row.taxYear}`;
          const data = {
            nik: row.nik,
            name: row.name,
            taxYear: row.taxYear,
            statusPtkp: row.statusPtkp,
            category: row.category || null,
            sourceData: row.sourceData || null,
            note: row.note || null,
          };
          await tx.pph21RecipientPtkp.upsert({
            where: { nik_taxYear: { nik: row.nik, taxYear: row.taxYear } },
            create: data,
            update: data,
          });
          const isDuplicate = existingByKey.has(key);
          if (isDuplicate) duplicateCount += 1;
          results.push({
            ...row,
            status: isDuplicate ? "DUPLICATE" : "VALID",
            message: isDuplicate ? "Data tahun pajak ini sudah ada dan diperbarui" : undefined,
          });
          importedCount += 1;
        }
        await tx.auditLog.create({
          data: {
            userName: user.name,
            username: user.username,
            action: "Imported PPh 21 PTKP Master",
            target: `${file.name} - ${uniqueValidRows.length} rows`,
            category: "DATA",
            type: "success",
          },
        });
      }, { timeout: 20_000, maxWait: 5_000 });
    } else {
      for (const row of uniqueValidRows) {
        const key = `${row.nik}-${row.taxYear}`;
        const isDuplicate = existingByKey.has(key);
        if (isDuplicate) duplicateCount += 1;
        results.push({
          ...row,
          status: isDuplicate ? "DUPLICATE" : "VALID",
          message: isDuplicate ? "Data tahun pajak ini sudah ada" : undefined,
        });
      }
    }

    const invalidRows = validRows.filter((row) => row.status === "INVALID");
    invalidCount += invalidRows.length;
    results.push(...invalidRows);

    results.sort((a, b) => a.rowNumber - b.rowNumber);

    return NextResponse.json({
      fileName: file.name,
      totalRows: parsedRows.length,
      importedCount,
      duplicateCount,
      invalidCount,
      previewOnly,
      rows: results,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengimpor master PTKP" }, { status: 400 });
  }
}
