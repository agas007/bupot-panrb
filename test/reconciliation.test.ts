import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { buildCoretaxComparisonReport, buildMonthlyComparisonRows } from "../src/lib/reconciliation.ts";
import { parseCoretaxExcel } from "../src/lib/excel.ts";

test("aggregates monthly comparison rows by NIK first", () => {
  const { rows, totals } = buildMonthlyComparisonRows(
    [
      { nik: "3275090906680014", name: "Linda Wati", amount: 150000, reference: "SP2D-01" },
      { nik: "3275090906680014", name: "LINDA    WATI", amount: 50000, reference: "SP2D-02" },
      { nik: "3275081107890004", name: "Budi Santoso", amount: 100000, reference: "SP2D-03" },
      { name: "Tanpa NIK", amount: 25000, reference: "SP2D-04" },
      { nik: "3275010101010005", name: "Rahma Putri", amount: 75000, reference: "SP2D-05" },
    ],
    [
      { nik: "3275090906680014", name: "Linda Wati", amount: 200000, reference: "CORETAX-01" },
      { nik: "3275081107890004", name: "Budi Santoso", amount: 100000, reference: "CORETAX-02" },
      { nik: "3175086001760002", name: "Sari Dewi", amount: 75000, reference: "CORETAX-03" },
      { name: "Tanpa NIK", amount: 25000, reference: "CORETAX-04" },
    ]
  );

  assert.equal(rows.length, 5);

  const byName = new Map(rows.map((row) => [row.name, row]));
  assert.equal(byName.get("Budi Santoso")?.status, "MATCHED");
  assert.equal(byName.get("Linda Wati")?.status, "MATCHED");
  assert.equal(byName.get("Linda Wati")?.appAmount, 200000);
  assert.equal(byName.get("Linda Wati")?.matchBy, "NIK");
  assert.equal(byName.get("Tanpa NIK")?.status, "MATCHED");
  assert.equal(byName.get("Rahma Putri")?.status, "ONLY_IN_APP");
  assert.equal(byName.get("Sari Dewi")?.status, "ONLY_IN_CORTEX");
  assert.equal(totals.appAmount, 400000);
  assert.equal(totals.cortexAmount, 400000);
  assert.equal(totals.onlyInAppCount, 1);
  assert.equal(totals.onlyInCortexCount, 1);
});

test("keeps same names separate when NIK differs", () => {
  const { rows } = buildMonthlyComparisonRows(
    [
      { nik: "3275090906680014", name: "Adityo Trimurdani", amount: 300000, reference: "APP-01" },
      { nik: "3275090906680015", name: "Adityo Trimurdani", amount: 200000, reference: "APP-02" },
    ],
    [
      { nik: "3275090906680014", name: "Adityo Trimurdani", amount: 300000, reference: "CORE-01" },
      { nik: "3275090906680016", name: "Adityo Trimurdani", amount: 200000, reference: "CORE-02" },
    ]
  );

  assert.equal(rows.length, 3);
  const matchedRow = rows.find((row) => row.appNik === "3275090906680014");
  assert.equal(matchedRow?.status, "MATCHED");
  assert.equal(matchedRow?.matchBy, "NIK");

  const appOnlyRow = rows.find((row) => row.appNik === "3275090906680015");
  const cortexOnlyRow = rows.find((row) => row.cortexNik === "3275090906680016");
  assert.equal(appOnlyRow?.status, "ONLY_IN_APP");
  assert.equal(cortexOnlyRow?.status, "ONLY_IN_CORTEX");
});

test("parses a Coretax CSV export with English headers", () => {
  const csv = [
    ",,TaxPeriodCode,WithholdingSlipsNumber,WithholdingSlipsStatus,ESignStatus,BranchId,TaxArticle,TaxObjectCode,TaxIdentificationNumber,Name,TaxBase,IncomeTax,TaxCertificateCode",
    ",Juni 2026,,Disimpan,,0001861061012000000000,Pasal 23,24-104-65,0038031043042000,ARJUNA RAYA JAYASENA,20410150,408203,Tanpa Fasilitas",
    ",Juni 2026,,Disimpan,,0001861061012000000000,Pasal 23,24-104-65,0724633243076000,THAMRIN EKSPRESS INDONESIA,47600000,952000,Tanpa Fasilitas",
  ].join("\n");

  const rows = parseCoretaxExcel(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].nik, "0038031043042000");
  assert.equal(rows[0].name, "ARJUNA RAYA JAYASENA");
  assert.equal(rows[0].amount, 408203);
  assert.equal(rows[0].period, "Juni 2026");
  assert.equal(rows[0].reference, "");
  assert.equal(rows[0].taxObjectCode, "24-104-65");
  assert.equal(rows[0].taxArticle, "Pasal 23");
});

test("parses a Coretax Excel sheet with NIK and tax columns", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "Masa Pajak",
      "Nomor Pemotongan",
      "Status",
      "NITKU/Nomor Identitas Sub Unit Organisasi",
      "Nomor Identitas WP",
      "Nama",
      "Jenis Pajak",
      "Pajak Penghasilan (Rp)",
      "Kode Objek Pajak",
    ],
    ["Juni 2026", null, "Disimpan", "0001861061012000000000", "3175086001760002", "Linda Wati", "Pasal 21", "Rp 200.000", "21-402-03"],
    ["Juni 2026", null, "Disimpan", "0001861061012000000000", "3404081112750002", "Budi Santoso", "Pasal 21", "100000", "21-402-03"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const rows = parseCoretaxExcel(buffer);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].nik, "3175086001760002");
  assert.equal(rows[0].name, "Linda Wati");
  assert.equal(rows[0].amount, 200000);
  assert.equal(rows[0].period, "Juni 2026");
  assert.equal(rows[0].taxArticle, "Pasal 21");
  assert.equal(rows[0].taxObjectCode, "21-402-03");
  assert.equal(rows[1].amount, 100000);
});

test("parses Coretax exports that include NITKU before tax columns", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "Masa Pajak",
      "Nomor Pemotongan",
      "Status",
      "Status Tanda Tangan Elektronik",
      "NITKU/Nomor Identitas Sub Unit Organisasi",
      "Jenis Pajak",
      "Kode Objek Pajak",
      "Nomor Identitas WP",
      "Nama",
      "Dasar Pengenaan Pajak (Rp)",
      "Pajak Penghasilan (Rp)",
      "Fasilitas Pajak",
    ],
    [
      "Juli 2026",
      null,
      "Disimpan",
      null,
      "0001861061012000000000",
      "Pasal 21",
      "21-100-18",
      "3203181811900001",
      "YUSUP MUNAWAR",
      850000,
      21250,
      "Tanpa Fasilitas",
    ],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "data");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const rows = parseCoretaxExcel(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].nik, "3203181811900001");
  assert.equal(rows[0].name, "YUSUP MUNAWAR");
  assert.equal(rows[0].amount, 21250);
  assert.equal(rows[0].period, "Juli 2026");
  assert.equal(rows[0].taxObjectCode, "21-100-18");
  assert.equal(rows[0].reference, "");
});

test("builds a Coretax comparison report with detected tax articles", () => {
  const report = buildCoretaxComparisonReport({
    fileName: "coretax.xlsx",
    periodLabel: "Juni 2026",
    sourcePeriods: ["Juni 2026"],
    sourceTaxArticles: ["Pasal 21", "Pasal 23"],
    appRows: [
      { nik: "3175086001760002", name: "Linda Wati", amount: 200000, reference: "APP-01", operator: "Agas" },
      { nik: "3175086001760002", name: "Linda Wati", amount: 50000, reference: "APP-02", operator: "Dinda" },
    ],
    cortexRows: [
      { nik: "3175086001760002", name: "Linda Wati", amount: 210000, reference: "CORE-01" },
    ],
  });

  assert.equal(report.fileName, "coretax.xlsx");
  assert.equal(report.sourceTaxArticles.length, 2);
  assert.equal(report.rows[0].status, "UNDER");
  assert.equal(report.totals.difference, -40000);
  assert.deepEqual(report.rows[0].appOperators.sort(), ["Agas", "Dinda"]);
});
