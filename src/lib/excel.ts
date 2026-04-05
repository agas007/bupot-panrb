import * as XLSX from "xlsx";

export interface PotonganRow {
  "Nomor SPM": string;
  "Akun": string;
  "Jumlah Potongan": number;
  [key: string]: any;
}

export interface SPP_SPM_SP2D_Row {
  "Nomor SPM": string;
  "Tanggal SPM": string | Date;
  "Nomor SP2D": string;
  "Tanggal SP2D": string | Date;
  "Uraian SPM": string;
  "Atas Nama": string;
  "Nilai": number;
  [key: string]: any;
}

export const parseExcel = (buffer: Buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

export const mergeExcelData = (
  potonganData: PotonganRow[],
  sppData: SPP_SPM_SP2D_Row[]
) => {
  // Create a map for SPP data by Nomor SPM for fast lookup
  const sppMap = new Map<string, SPP_SPM_SP2D_Row>();
  sppData.forEach((row) => {
    if (row["Nomor SPM"]) {
      sppMap.set(row["Nomor SPM"].toString().trim(), row);
    }
  });

  // Merge Potongan data with SPP details
  return potonganData.map((potongan) => {
    const spmNo = potongan["Nomor SPM"]?.toString().trim();
    const sppDetails = sppMap.get(spmNo);

    return {
      uniqueKey: `${spmNo}-${potongan["Akun"]}-${potongan["Jumlah Potongan"]}`,
      spmNumber: spmNo,
      accountCode: potongan["Akun"]?.toString() || "",
      deductionAmount: Number(potongan["Jumlah Potongan"]) || 0,
      spmDate: sppDetails ? new Date(sppDetails["Tanggal SPM"]) : new Date(),
      sp2dNumber: sppDetails?.["Nomor SP2D"] || "",
      sp2dDate: sppDetails ? new Date(sppDetails["Tanggal SP2D"]) : null,
      description: sppDetails?.["Uraian SPM"] || "",
      recipient: sppDetails?.["Atas Nama"] || "",
      totalValue: Number(sppDetails?.["Nilai"]) || 0,
    };
  });
};
