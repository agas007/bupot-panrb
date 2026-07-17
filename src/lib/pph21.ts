export const PPH21_ACCOUNT_CODE = "411121";

export const PPH21_TAX_OBJECTS = {
  "21-100-07": { deemed: 50, rate: 5 },
  "21-402-04": { deemed: 100, rate: 0 },
  "21-402-02": { deemed: 100, rate: 5 },
  "21-402-03": { deemed: 100, rate: 15 },
} as const;

export const MM_PAYROLL_TAX_OBJECT_CODE = "21-100-01";
export const MM_PAYROLL_COUNTERPART_OPT = "Resident";
export const MM_PAYROLL_POSITION = "STAFF";
export const MM_PAYROLL_TAX_CERTIFICATE = "N/A";
export const MM_PAYROLL_DEFAULT_ID_TKU = "0001861061012000000000";

export const PPH21_PTKP_STATUSES = [
  "TK/0",
  "TK/1",
  "TK/2",
  "TK/3",
  "K/0",
  "K/1",
  "K/2",
  "K/3",
  "K/I/0",
  "K/I/1",
  "K/I/2",
  "K/I/3",
] as const;

export type Pph21PtkpStatus = typeof PPH21_PTKP_STATUSES[number];

export const PPH21_TAX_OBJECT_LABELS = {
  "21-100-07": "Imbalan tenaga ahli / konsultan / profesional, deemed 50% tarif 5%",
  "21-402-04": "Honor/imbalan lain APBN/APBD untuk gol I/II, TNI/Polri tamtama/bintara, pensiunan — deemed 100% tarif 0%",
  "21-402-02": "Honor/imbalan lain APBN/APBD untuk PNS gol III, TNI/Polri perwira pertama, pensiunan — deemed 100% tarif 5%",
  "21-402-03": "Honor/imbalan lain APBN/APBD untuk pejabat negara, PNS gol IV, TNI/Polri perwira menengah/tinggi, pensiunan — deemed 100% tarif 15%",
} as const satisfies Record<keyof typeof PPH21_TAX_OBJECTS, string>;

export type Pph21TaxObjectCode = keyof typeof PPH21_TAX_OBJECTS;
export type Pph21ProcessStatus = "PENDING" | "DATA_ENTERED" | "COMPLETED" | "ISSUES";

export type Pph21LineInput = {
  nik: string;
  name: string;
  taxObjectCode: string;
  gross: number | string;
};

export function isPph21TaxObjectCode(value: string): value is Pph21TaxObjectCode {
  return Object.prototype.hasOwnProperty.call(PPH21_TAX_OBJECTS, value);
}

export function normalizeNik(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function calculatePph21Tax(gross: number, deemed: number, rate: number) {
  return Math.round(gross * (deemed / 100) * (rate / 100));
}

export function normalizePtkpStatus(value: unknown): Pph21PtkpStatus | null {
  const status = String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
  return (PPH21_PTKP_STATUSES as readonly string[]).includes(status) ? (status as Pph21PtkpStatus) : null;
}

export function isSupportedPtkpStatus(value: unknown): value is Pph21PtkpStatus {
  return normalizePtkpStatus(value) !== null;
}

export function getPtkpTerCategory(value: unknown) {
  const status = normalizePtkpStatus(value);
  if (!status) return null;
  if (status === "TK/0" || status === "TK/1" || status === "K/0" || status === "K/I/0" || status === "K/I/1") return "A" as const;
  if (status === "TK/2" || status === "TK/3" || status === "K/1" || status === "K/2" || status === "K/I/2") return "B" as const;
  if (status === "K/3" || status === "K/I/3") return "C" as const;
  return null;
}

export function resolvePtkpForTaxYear<T extends { taxYear: number }>(rows: T[], taxYear: number) {
  const exact = rows.find((row) => row.taxYear === taxYear);
  if (exact) return exact;
  return rows
    .filter((row) => row.taxYear <= taxYear)
    .sort((a, b) => b.taxYear - a.taxYear)[0] || null;
}

export function normalizePph21Lines(lines: Pph21LineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Minimal satu penerima PPh 21 wajib diisi.");
  }

  return lines.map((line, index) => {
    const nik = normalizeNik(line.nik);
    const name = String(line.name || "").trim();
    const gross = Number(line.gross);
    if (nik && !/^\d{16}$/.test(nik)) throw new Error(`NIK baris ${index + 1} harus 16 digit.`);
    if (!name) throw new Error(`Nama penerima baris ${index + 1} wajib diisi.`);
    if (!isPph21TaxObjectCode(line.taxObjectCode)) throw new Error(`Kode objek pajak baris ${index + 1} tidak didukung.`);
    if (!Number.isInteger(gross) || gross < 0) throw new Error(`Gross baris ${index + 1} harus berupa rupiah bulat non-negatif.`);
    const rule = PPH21_TAX_OBJECTS[line.taxObjectCode];
    return {
      nik,
      name,
      taxObjectCode: line.taxObjectCode,
      gross,
      deemed: rule.deemed,
      rate: rule.rate,
      calculatedTax: calculatePph21Tax(gross, rule.deemed, rule.rate),
    };
  });
}

export function formatDateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Tanggal tidak valid.");
  return date.toISOString().slice(0, 10);
}

function normalizeFileNamePart(value: string) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function buildPph21ExportFileName(
  records: Array<{ spmNumber: string; sp2dNumber: string | null }>,
  exportedByName: string,
  now = new Date(),
) {
  if (!records.length) {
    throw new Error("Minimal satu record wajib dipilih.");
  }

  const firstRecord = records[0];
  const spmNumber = normalizeFileNamePart(firstRecord.spmNumber) || "SPM";
  const sp2dNumber = normalizeFileNamePart(firstRecord.sp2dNumber || "") || "SP2D";
  const exporterName = normalizeFileNamePart(exportedByName) || "petugas";
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const batchSuffix = records.length > 1 ? `_x${records.length}` : "";

  return `Bupot_PPh21_${spmNumber}_${sp2dNumber}_${exporterName}${batchSuffix}_${timestamp}.xml`;
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type XmlBatch = {
  withholdingDate: Date;
  record: { sp2dNumber: string | null; sp2dDate: Date | null };
  withholdings: Array<{
    recipient: { nik: string };
    taxObjectCode: string;
    gross: number;
    deemed: number;
    rate: number;
  }>;
};

export function buildPph21Xml(batches: XmlBatch[]) {
  const rows = batches.flatMap((batch) => {
    if (!batch.record.sp2dNumber || !batch.record.sp2dDate || !batch.withholdingDate) {
      throw new Error("Nomor SP2D, tanggal SP2D, dan tanggal potong wajib tersedia.");
    }
    const sp2dDate = batch.record.sp2dDate;
    return batch.withholdings.map((line) => [
      "\t\t<Bp21>",
      `\t\t\t<TaxPeriodMonth>${sp2dDate.getUTCMonth() + 1}</TaxPeriodMonth>`,
      `\t\t\t<TaxPeriodYear>${sp2dDate.getUTCFullYear()}</TaxPeriodYear>`,
      `\t\t\t<CounterpartTin>${escapeXml(line.recipient.nik)}</CounterpartTin>`,
      `\t\t\t<IDPlaceOfBusinessActivityOfIncomeRecipient>${escapeXml(line.recipient.nik)}000000</IDPlaceOfBusinessActivityOfIncomeRecipient>`,
      "\t\t\t<StatusTaxExemption>TK/0</StatusTaxExemption>",
      "\t\t\t<TaxCertificate>N/A</TaxCertificate>",
      `\t\t\t<TaxObjectCode>${escapeXml(line.taxObjectCode)}</TaxObjectCode>`,
      `\t\t\t<Gross>${line.gross}</Gross>`,
      `\t\t\t<Deemed>${line.deemed}</Deemed>`,
      `\t\t\t<Rate>${line.rate}</Rate>`,
      "\t\t\t<Document>PaymentProof</Document>",
      `\t\t\t<DocumentNumber>${escapeXml(batch.record.sp2dNumber)}</DocumentNumber>`,
      `\t\t\t<DocumentDate>${formatDateOnly(sp2dDate)}</DocumentDate>`,
      "\t\t\t<IDPlaceOfBusinessActivity>0001861061012000000000</IDPlaceOfBusinessActivity>",
      `\t\t\t<WithholdingDate>${formatDateOnly(batch.withholdingDate)}</WithholdingDate>`,
      "\t\t</Bp21>",
    ].join("\n"));
  });

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Bp21Bulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    "\t<TIN>0001861061012000</TIN>",
    "\t<ListOfBp21>",
    ...rows,
    "\t</ListOfBp21>",
    "</Bp21Bulk>",
  ].join("\n");
}

type MmPayrollXmlRow = {
  taxPeriodMonth: number;
  taxPeriodYear: number;
  counterpartTin: string;
  statusTaxExemption: string;
  gross: number;
  rate: number;
  withholdingDate: Date | string;
  counterpartPassport?: string | null;
  counterpartOpt?: string;
  position?: string;
  taxCertificate?: string;
  taxObjectCode?: string;
  idPlaceOfBusinessActivity?: string;
};

export function buildMmPayrollXml(rows: MmPayrollXmlRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Minimal satu baris MmPayroll wajib diisi.");
  }

  const serializedRows = rows.map((row, index) => {
    if (!Number.isInteger(row.taxPeriodMonth) || row.taxPeriodMonth < 1 || row.taxPeriodMonth > 12) {
      throw new Error(`TaxPeriodMonth baris ${index + 1} tidak valid.`);
    }
    if (!Number.isInteger(row.taxPeriodYear)) {
      throw new Error(`TaxPeriodYear baris ${index + 1} tidak valid.`);
    }
    const counterpartTin = normalizeNik(row.counterpartTin);
    if (!/^\d{16}$/.test(counterpartTin)) throw new Error(`CounterpartTin baris ${index + 1} harus 16 digit.`);
    const statusTaxExemption = normalizePtkpStatus(row.statusTaxExemption);
    if (!statusTaxExemption) throw new Error(`StatusTaxExemption baris ${index + 1} tidak valid.`);
    if (!Number.isFinite(row.gross) || row.gross < 0) throw new Error(`Gross baris ${index + 1} tidak valid.`);
    if (!Number.isFinite(row.rate) || row.rate < 0) throw new Error(`Rate baris ${index + 1} tidak valid.`);
    const withholdingDate = formatDateOnly(row.withholdingDate);

    return [
      "\t\t<MmPayroll>",
      `\t\t\t<TaxPeriodMonth>${row.taxPeriodMonth}</TaxPeriodMonth>`,
      `\t\t\t<TaxPeriodYear>${row.taxPeriodYear}</TaxPeriodYear>`,
      `\t\t\t<CounterpartOpt>${escapeXml(row.counterpartOpt || MM_PAYROLL_COUNTERPART_OPT)}</CounterpartOpt>`,
      row.counterpartPassport ? `\t\t\t<CounterpartPassport>${escapeXml(row.counterpartPassport)}</CounterpartPassport>` : '\t\t\t<CounterpartPassport xsi:nil="true"/>',
      `\t\t\t<CounterpartTin>${escapeXml(counterpartTin)}</CounterpartTin>`,
      `\t\t\t<StatusTaxExemption>${escapeXml(statusTaxExemption)}</StatusTaxExemption>`,
      `\t\t\t<Position>${escapeXml(row.position || MM_PAYROLL_POSITION)}</Position>`,
      `\t\t\t<TaxCertificate>${escapeXml(row.taxCertificate || MM_PAYROLL_TAX_CERTIFICATE)}</TaxCertificate>`,
      `\t\t\t<TaxObjectCode>${escapeXml(row.taxObjectCode || MM_PAYROLL_TAX_OBJECT_CODE)}</TaxObjectCode>`,
      `\t\t\t<Gross>${row.gross}</Gross>`,
      `\t\t\t<Rate>${row.rate}</Rate>`,
      `\t\t\t<IDPlaceOfBusinessActivity>${escapeXml(row.idPlaceOfBusinessActivity || MM_PAYROLL_DEFAULT_ID_TKU)}</IDPlaceOfBusinessActivity>`,
      `\t\t\t<WithholdingDate>${withholdingDate}</WithholdingDate>`,
      "\t\t</MmPayroll>",
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<MmPayrollBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    "\t<TIN>0001861061012000</TIN>",
    "\t<ListOfMmPayroll>",
    ...serializedRows,
    "\t</ListOfMmPayroll>",
    "</MmPayrollBulk>",
  ].join("\n");
}

export type ImportedPph21Line = {
  documentNumber: string;
  documentDate: string;
  withholdingDate: string;
  counterpartTin: string;
  taxObjectCode: string;
  gross: number;
  deemed: number;
  rate: number;
  calculatedTax: number;
  taxPeriodMonth: number;
  taxPeriodYear: number;
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function readXmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}\\s*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

export function parsePph21Xml(xml: string): ImportedPph21Line[] {
  if (!xml.trim()) throw new Error("File XML kosong.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("DOCTYPE dan ENTITY tidak diperbolehkan.");
  if (!/<Bp21Bulk\b/i.test(xml)) throw new Error("Root Bp21Bulk tidak ditemukan.");
  const blocks = Array.from(xml.matchAll(/<Bp21\b[^>]*>([\s\S]*?)<\/Bp21>/gi), (match) => match[1]);
  if (blocks.length === 0) throw new Error("XML tidak memiliki data Bp21.");

  return blocks.map((block, index) => {
    const documentNumber = readXmlTag(block, "DocumentNumber");
    const documentDate = readXmlTag(block, "DocumentDate");
    const withholdingDate = readXmlTag(block, "WithholdingDate");
    const counterpartTin = normalizeNik(readXmlTag(block, "CounterpartTin"));
    const taxObjectCode = readXmlTag(block, "TaxObjectCode");
    const gross = Number(readXmlTag(block, "Gross"));
    const deemed = Number(readXmlTag(block, "Deemed"));
    const rate = Number(readXmlTag(block, "Rate"));
    const taxPeriodMonth = Number(readXmlTag(block, "TaxPeriodMonth"));
    const taxPeriodYear = Number(readXmlTag(block, "TaxPeriodYear"));
    if (!documentNumber) throw new Error(`DocumentNumber baris ${index + 1} kosong.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(withholdingDate) || Number.isNaN(new Date(withholdingDate).getTime())) throw new Error(`WithholdingDate baris ${index + 1} tidak valid.`);
    if (!/^\d{16}$/.test(counterpartTin)) throw new Error(`CounterpartTin baris ${index + 1} harus 16 digit.`);
    if (!isPph21TaxObjectCode(taxObjectCode)) throw new Error(`TaxObjectCode baris ${index + 1} tidak didukung.`);
    if (![gross, deemed, rate].every(Number.isFinite) || gross < 0 || deemed < 0 || rate < 0) throw new Error(`Nilai pajak baris ${index + 1} tidak valid.`);
    if (!Number.isInteger(taxPeriodMonth) || taxPeriodMonth < 1 || taxPeriodMonth > 12 || !Number.isInteger(taxPeriodYear)) throw new Error(`Periode pajak baris ${index + 1} tidak valid.`);
    return { documentNumber, documentDate, withholdingDate, counterpartTin, taxObjectCode, gross, deemed, rate, calculatedTax: calculatePph21Tax(gross, deemed, rate), taxPeriodMonth, taxPeriodYear };
  });
}

export type ImportedMmPayrollLine = {
  counterpartTin: string;
  statusTaxExemption: string;
  position: string;
  taxObjectCode: string;
  gross: number;
  rate: number;
  withholdingDate: string;
  taxPeriodMonth: number;
  taxPeriodYear: number;
  calculatedTax: number;
};

export function calculateMmPayrollTax(gross: number, rate: number) {
  return Math.round(gross * (rate / 100));
}

export function parseMmPayrollXml(xml: string): ImportedMmPayrollLine[] {
  if (!xml.trim()) throw new Error("File XML kosong.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("DOCTYPE dan ENTITY tidak diperbolehkan.");
  if (!/<MmPayrollBulk\b/i.test(xml)) throw new Error("Root MmPayrollBulk tidak ditemukan.");
  const blocks = Array.from(xml.matchAll(/<MmPayroll\b[^>]*>([\s\S]*?)<\/MmPayroll>/gi), (match) => match[1]);
  if (blocks.length === 0) throw new Error("XML tidak memiliki data MmPayroll.");

  return blocks.map((block, index) => {
    const counterpartTin = normalizeNik(readXmlTag(block, "CounterpartTin"));
    const statusTaxExemption = readXmlTag(block, "StatusTaxExemption");
    const position = readXmlTag(block, "Position");
    const taxObjectCode = readXmlTag(block, "TaxObjectCode");
    const gross = Number(readXmlTag(block, "Gross"));
    const rate = Number(readXmlTag(block, "Rate"));
    const withholdingDate = readXmlTag(block, "WithholdingDate");
    const taxPeriodMonth = Number(readXmlTag(block, "TaxPeriodMonth"));
    const taxPeriodYear = Number(readXmlTag(block, "TaxPeriodYear"));
    if (!/^\d{16}$/.test(counterpartTin)) throw new Error(`CounterpartTin baris ${index + 1} harus 16 digit.`);
    if (!statusTaxExemption) throw new Error(`StatusTaxExemption baris ${index + 1} wajib diisi.`);
    if (!position) throw new Error(`Position baris ${index + 1} wajib diisi.`);
    if (!taxObjectCode) throw new Error(`TaxObjectCode baris ${index + 1} wajib diisi.`);
    if (![gross, rate].every(Number.isFinite) || gross < 0 || rate < 0) throw new Error(`Nilai gross/rate baris ${index + 1} tidak valid.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(withholdingDate) || Number.isNaN(new Date(withholdingDate).getTime())) throw new Error(`WithholdingDate baris ${index + 1} tidak valid.`);
    if (!Number.isInteger(taxPeriodMonth) || taxPeriodMonth < 1 || taxPeriodMonth > 12 || !Number.isInteger(taxPeriodYear)) throw new Error(`Periode pajak baris ${index + 1} tidak valid.`);
    return {
      counterpartTin,
      statusTaxExemption,
      position,
      taxObjectCode,
      gross,
      rate,
      withholdingDate,
      taxPeriodMonth,
      taxPeriodYear,
      calculatedTax: calculateMmPayrollTax(gross, rate),
    };
  });
}
