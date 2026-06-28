export const PPH21_ACCOUNT_CODE = "411121";

export const PPH21_TAX_OBJECTS = {
  "21-100-07": { deemed: 50, rate: 5 },
  "21-402-04": { deemed: 100, rate: 0 },
  "21-402-02": { deemed: 100, rate: 5 },
  "21-402-03": { deemed: 100, rate: 15 },
} as const;

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
  return Math.floor(gross * (deemed / 100) * (rate / 100));
}

export function normalizePph21Lines(lines: Pph21LineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Minimal satu penerima PPh 21 wajib diisi.");
  }

  return lines.map((line, index) => {
    const nik = normalizeNik(line.nik);
    const name = String(line.name || "").trim();
    const gross = Number(line.gross);
    if (!/^\d{16}$/.test(nik)) throw new Error(`NIK baris ${index + 1} harus 16 digit.`);
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
