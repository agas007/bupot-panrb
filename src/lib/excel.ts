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

export const parseCoretaxExcel = (input: Buffer | ArrayBuffer) => {
  const isBuffer = typeof Buffer !== "undefined" && input instanceof Buffer;
  const workbook = XLSX.read(input, { type: isBuffer ? "buffer" : "array", raw: true, cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("File Coretax tidak memiliki sheet.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as unknown[][];
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const normalized = normalizeHeaderText(cell);
      return normalized.includes("NAMA") || normalized.includes("RECIPIENT") || normalized.includes("ATAS NAMA");
    }) &&
    row.some((cell) => {
      const normalized = normalizeHeaderText(cell);
      return normalized.includes("PAJAK PENGHASILAN") || normalized.includes("PENGHASILAN") || normalized.includes("NOMINAL") || normalized.includes("NILAI") || normalized.includes("POTONGAN");
    })
  );

  if (headerIndex < 0) {
    throw new Error("Header file Coretax tidak ditemukan. Pastikan ada kolom nama dan nominal.");
  }

  const headerRow = rows[headerIndex];
  const nikColumn = findColumnIndex(headerRow, ["NOMOR IDENTITAS WP", "NIK", "NPWP", "IDENTITAS", "NOMOR IDENTITAS"]);
  const nameColumn = findColumnIndex(headerRow, ["NAMA", "ATAS NAMA", "RECIPIENT", "NAMA PENERIMA", "PEGAWAI"]);
  const amountColumn = findColumnIndex(headerRow, ["PAJAK PENGHASILAN", "PENGHASILAN", "PPh", "PPH", "NOMINAL", "NILAI", "AMOUNT"]);
  const referenceColumn = findColumnIndex(headerRow, ["NOMOR PEMOTONGAN", "SPM", "NO SPM", "NO.SPM", "SP2D", "NO SP2D", "NO.SP2D", "REFERENSI", "REFERENCE"]);
  const periodColumn = findColumnIndex(headerRow, ["MASA PAJAK", "PERIODE", "BULAN", "MONTH"]);
  const taxObjectCodeColumn = findColumnIndex(headerRow, ["KODE OBJEK PAJAK", "KODE OBJEK", "TAX OBJECT CODE"]);

  if (nameColumn < 0 || amountColumn < 0) {
    throw new Error("Kolom Nama dan Pajak Penghasilan pada file Coretax wajib ada.");
  }

  const result: CoretaxExcelRow[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const nik = nikColumn >= 0 ? normalizeText(row[nikColumn]).replace(/\D/g, "") : "";
    const name = normalizeText(row[nameColumn]);
    const amount = safeIndoNum(row[amountColumn]);
    const reference = referenceColumn >= 0 ? String(row[referenceColumn] ?? "").trim() : "";
    const period = periodColumn >= 0 ? String(row[periodColumn] ?? "").trim() : "";
    const taxObjectCode = taxObjectCodeColumn >= 0 ? normalizeText(row[taxObjectCodeColumn]) : "";

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
