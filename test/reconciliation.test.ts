import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { buildMonthlyComparisonRows } from "../src/lib/reconciliation.ts";
import { parseCortexExcel } from "../src/lib/excel.ts";

test("aggregates monthly comparison rows by normalized name", () => {
  const { rows, totals } = buildMonthlyComparisonRows(
    [
      { name: "Linda Wati", amount: 150000, reference: "SP2D-01" },
      { name: "Linda    Wati", amount: 50000, reference: "SP2D-02" },
      { name: "Budi Santoso", amount: 100000, reference: "SP2D-03" },
    ],
    [
      { name: "Linda Wati", amount: 200000, reference: "CORTEX-01" },
      { name: "Budi Santoso", amount: 100000, reference: "CORTEX-02" },
      { name: "Sari Dewi", amount: 75000, reference: "CORTEX-03" },
    ]
  );

  assert.equal(rows.length, 3);
  assert.equal(rows[0].name, "Budi Santoso");
  assert.equal(rows[0].status, "MATCHED");
  assert.equal(rows[1].name, "Linda Wati");
  assert.equal(rows[1].status, "MATCHED");
  assert.equal(rows[1].appAmount, 200000);
  assert.equal(rows[2].status, "ONLY_IN_CORTEX");
  assert.equal(totals.appAmount, 300000);
  assert.equal(totals.cortexAmount, 375000);
  assert.equal(totals.onlyInCortexCount, 1);
});

test("parses a Coretax Excel sheet with name and nominal columns", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Nama", "Nominal", "Referensi"],
    ["Linda Wati", "Rp 200.000", "SP2D-01"],
    ["Budi Santoso", "100000", "SP2D-02"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const rows = parseCortexExcel(buffer);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Linda Wati");
  assert.equal(rows[0].amount, 200000);
  assert.equal(rows[0].reference, "SP2D-01");
  assert.equal(rows[1].amount, 100000);
});
