import * as XLSX from "xlsx";

export interface PotonganRow {
  "NO.SPM": string;
  "Akun": string;
  "Jumlah": number;
  "TGL.SPM"?: string | number;
  "No.SP2D/NTPN"?: string;
  "Tgl. SP2D"?: string | number;
  "Uraian SPM"?: string;
  "Atas Nama"?: string;
  [key: string]: any;
}

export interface SPP_SPM_SP2D_Row {
  "No. SPP/SPM": string;
  "Jumlah Pengeluaran": number;
  [key: string]: any;
}

export interface CoretaxExcelRow {
  rowNumber: number;
  nik: string;
  name: string;
  amount: number;
  reference: string;
  period: string;
  taxObjectCode: string;
}

export const parseExcel = (buffer: Buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  // Skip 2 rows for title, headers on row 3 (range: 2)
  // Use raw: true to avoid library pre-formatting dates
  return XLSX.utils.sheet_to_json(worksheet, { range: 2, raw: true, defval: null });
};

const safeDateID = (val: any) => {
  if (!val || val === "-" || val === "") return null;
  
  // Handle Excel serial numbers (numbers)
  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    return new Date(date.y, date.m - 1, date.d);
  }

  // Handle strings 
  if (typeof val === "string") {
    const cleanStr = val.trim();
    
    // Case 1: YYYY-MM-DD (SPP File)
    if (cleanStr.includes("-") && cleanStr.length >= 10 && cleanStr.split("-")[0].length === 4) {
      const d = new Date(cleanStr);
      return isNaN(d.getTime()) ? null : d;
    }

    // Case 2: D/M/YYYY (Potongan File - User's gold standard)
    const parts = cleanStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // Month 0-indexed
      const y = parseInt(parts[2], 10);
      
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const safeIndoNum = (val: any) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  
  // Indonesian style: 1.000,50 
  // Step 1: Remove all dots (thousands separator)
  // Step 2: Replace comma with dot (decimal separator)
  const clean = val.toString().replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

function normalizeHeaderText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumnIndex(headerRow: unknown[], aliases: string[]) {
  for (let index = 0; index < headerRow.length; index += 1) {
    const normalized = normalizeHeaderText(headerRow[index]);
    if (!normalized) continue;
    if (aliases.some((alias) => {
      const normalizedAlias = normalizeHeaderText(alias);
      return normalized === normalizedAlias || normalized.includes(normalizedAlias);
    })) {
      return index;
    }
  }
  return -1;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function getWorkbookInputType(input: Buffer | ArrayBuffer | string) {
  if (typeof input === "string") return "string";
  return typeof Buffer !== "undefined" && input instanceof Buffer ? "buffer" : "array";
}

function getRowShift(row: unknown[], nikColumn: number) {
  if (nikColumn < 0) return 0;
  const directNik = normalizeText(row[nikColumn]).replace(/\D/g, "");
  if (directNik.length >= 10) return 0;

  for (let index = 0; index < row.length; index += 1) {
    if (index === nikColumn) continue;
    const candidate = normalizeText(row[index]).replace(/\D/g, "");
    if (/^\d{16}$/.test(candidate)) {
      return index - nikColumn;
    }
  }

  return 0;
}

function getShiftedRowValue(row: unknown[], columnIndex: number, shift: number) {
  if (columnIndex < 0) return null;
  if (shift !== 0) {
    const shiftedIndex = columnIndex + shift;
    if (shiftedIndex >= 0 && shiftedIndex < row.length) {
      return row[shiftedIndex] ?? null;
    }
    return null;
  }
  return row[columnIndex] ?? null;
}

export const parseCoretaxExcel = (input: Buffer | ArrayBuffer | string) => {
  const workbook = XLSX.read(input, { type: getWorkbookInputType(input), raw: true, cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("File Coretax tidak memiliki sheet.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as unknown[][];
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const normalized = normalizeHeaderText(cell);
      return (
        normalized.includes("NAMA") ||
        normalized.includes("NAME") ||
        normalized.includes("RECIPIENT") ||
        normalized.includes("ATAS NAMA")
      );
    }) &&
    row.some((cell) => {
      const normalized = normalizeHeaderText(cell);
      return (
        normalized.includes("PAJAK PENGHASILAN") ||
        normalized.includes("PENGHASILAN") ||
        normalized.includes("INCOME TAX") ||
        normalized.includes("INCOMETAX") ||
        normalized.includes("NOMINAL") ||
        normalized.includes("NILAI") ||
        normalized.includes("POTONGAN")
      );
    })
  );

  if (headerIndex < 0) {
    throw new Error("Header file Coretax tidak ditemukan. Pastikan ada kolom nama dan nominal.");
  }

  const headerRow = rows[headerIndex];
  const nikColumn = findColumnIndex(headerRow, [
    "NOMOR IDENTITAS WP",
    "TAX IDENTIFICATION NUMBER",
    "TAXIDENTIFICATIONNUMBER",
    "NIK",
    "NPWP",
    "IDENTITAS",
    "NOMOR IDENTITAS",
  ]);
  const nameColumn = findColumnIndex(headerRow, [
    "NAMA",
    "NAME",
    "ATAS NAMA",
    "RECIPIENT",
    "NAMA PENERIMA",
    "PEGAWAI",
  ]);
  const amountColumn = findColumnIndex(headerRow, [
    "PAJAK PENGHASILAN",
    "PENGHASILAN",
    "INCOME TAX",
    "INCOMETAX",
    "PPh",
    "PPH",
    "NOMINAL",
    "NILAI",
    "AMOUNT",
  ]);
  const referenceColumn = findColumnIndex(headerRow, [
    "NOMOR PEMOTONGAN",
    "WITHHOLDING SLIPS NUMBER",
    "WITHHOLDINGSLIPSNUMBER",
    "SPM",
    "NO SPM",
    "NO.SPM",
    "SP2D",
    "NO SP2D",
    "NO.SP2D",
    "REFERENSI",
    "REFERENCE",
  ]);
  const periodColumn = findColumnIndex(headerRow, [
    "MASA PAJAK",
    "TAX PERIOD CODE",
    "TAXPERIODCODE",
    "PERIODE",
    "BULAN",
    "MONTH",
  ]);
  const taxObjectCodeColumn = findColumnIndex(headerRow, [
    "KODE OBJEK PAJAK",
    "TAX OBJECT CODE",
    "TAXOBJECTCODE",
    "KODE OBJEK",
  ]);

  if (nameColumn < 0 || amountColumn < 0) {
    throw new Error("Kolom Nama dan Pajak Penghasilan pada file Coretax wajib ada.");
  }

  const result: CoretaxExcelRow[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowShift = getRowShift(row, nikColumn);
    const nik = nikColumn >= 0 ? normalizeText(getShiftedRowValue(row, nikColumn, rowShift)).replace(/\D/g, "") : "";
    const name = normalizeText(getShiftedRowValue(row, nameColumn, rowShift));
    const amount = safeIndoNum(getShiftedRowValue(row, amountColumn, rowShift));
    const reference = referenceColumn >= 0 ? String(getShiftedRowValue(row, referenceColumn, rowShift) ?? "").trim() : "";
    const period = periodColumn >= 0 ? String(getShiftedRowValue(row, periodColumn, rowShift) ?? "").trim() : "";
    const taxObjectCode = taxObjectCodeColumn >= 0 ? normalizeText(getShiftedRowValue(row, taxObjectCodeColumn, rowShift)) : "";

    if (!name && !nik && !reference && amount === 0) {
      continue;
    }

    if (!name && !nik) {
      continue;
    }

    result.push({
      rowNumber: rowIndex + 1,
      nik,
      name,
      amount,
      reference,
      period,
      taxObjectCode,
    });
  }

  if (result.length === 0) {
    throw new Error("Tidak ada baris data Coretax yang bisa dibaca dari sheet pertama.");
  }

  return result;
};

export const parseCortexExcel = parseCoretaxExcel;

export type CortexExcelRow = CoretaxExcelRow;

export const mergeExcelData = (
  potonganData: PotonganRow[],
  sppData: SPP_SPM_SP2D_Row[]
) => {
  // Create a map for SPP data by short SPM number (e.g. 00005T)
  const sppMap = new Map<string, number>();
  sppData.forEach((row) => {
    const spmKey = row["No. SPP/SPM"]?.toString().trim();
    if (spmKey) {
      sppMap.set(spmKey, safeIndoNum(row["Jumlah Pengeluaran"]));
    }
  });

  return potonganData.map((potongan) => {
    const spmFull = potongan["NO.SPM"]?.toString().trim();
    if (!spmFull) return null;

    // Extract base SPM (e.g. 00005T from 00005T/427950/2026)
    const spmBase = spmFull.split("/")[0];
    const totalValue = sppMap.get(spmBase) || 0;

    const deductionAmount = safeIndoNum(potongan["Jumlah"]);

    return {
      uniqueKey: `${spmFull}-${potongan["Akun"]}-${deductionAmount}`,
      spmNumber: spmFull,
      accountCode: potongan["Akun"]?.toString() || "",
      deductionAmount: deductionAmount,

      // Use Potongan file as primary source for dates and numbers
      spmDate: safeDateID(potongan["TGL.SPM"]) || new Date(),
      sp2dNumber: potongan["No.SP2D/NTPN"] || "",
      sp2dDate: safeDateID(potongan["Tgl. SP2D"]),
      description: potongan["Uraian SPM"] || "",
      recipient: potongan["Atas Nama"] || "",
      totalValue: totalValue,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
};
