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
  const clean = val.toString().replace(/\./g, "").replace(/,/g, ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

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

    return {
      uniqueKey: `${spmFull}-${potongan["Akun"]}-${potongan["Jumlah"]}`,
      spmNumber: spmFull,
      accountCode: potongan["Akun"]?.toString() || "",
      deductionAmount: safeIndoNum(potongan["Jumlah"]),
      
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
