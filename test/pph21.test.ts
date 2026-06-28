import assert from "node:assert/strict";
import test from "node:test";
import { buildPph21Xml, calculatePph21Tax, normalizePph21Lines, parsePph21Xml } from "../src/lib/pph21.ts";

test("maps supported tax objects and floors each calculated tax", () => {
  const lines = normalizePph21Lines([
    { nik: "1277014308900003", name: "Penerima Satu", taxObjectCode: "21-100-07", gross: 101 },
    { nik: "3275020507890029", name: "Penerima Dua", taxObjectCode: "21-402-03", gross: 1000 },
  ]);
  assert.equal(lines[0].deemed, 50);
  assert.equal(lines[0].calculatedTax, 2);
  assert.equal(lines[1].rate, 15);
  assert.equal(lines[1].calculatedTax, 150);
  assert.equal(calculatePph21Tax(272000, 100, 5), 13600);
});

test("rejects invalid NIK and unsupported object codes", () => {
  assert.throws(() => normalizePph21Lines([{ nik: "123", name: "Invalid", taxObjectCode: "21-999-99", gross: 1000 }]), /NIK/);
});

test("builds a Coretax-compatible XML row for every recipient", () => {
  const xml = buildPph21Xml([{
    withholdingDate: new Date("2026-06-12T00:00:00.000Z"),
    record: { sp2dNumber: "261330000047614", sp2dDate: new Date("2026-05-25T00:00:00.000Z") },
    withholdings: [
      { recipient: { nik: "1277014308900003" }, taxObjectCode: "21-402-03", gross: 1000000, deemed: 100, rate: 15 },
      { recipient: { nik: "3275020507890029" }, taxObjectCode: "21-402-02", gross: 272000, deemed: 100, rate: 5 },
    ],
  }]);
  assert.equal((xml.match(/<Bp21>/g) || []).length, 2);
  assert.match(xml, /<TaxPeriodMonth>5<\/TaxPeriodMonth>/);
  assert.match(xml, /<IDPlaceOfBusinessActivityOfIncomeRecipient>1277014308900003000000/);
  assert.match(xml, /<WithholdingDate>2026-06-12<\/WithholdingDate>/);
  const imported = parsePph21Xml(xml);
  assert.equal(imported.length, 2);
  assert.equal(imported[0].documentNumber, "261330000047614");
  assert.equal(imported[0].calculatedTax, 150000);
  assert.equal(imported[1].calculatedTax, 13600);
});

test("rejects unsafe or malformed imported XML", () => {
  assert.throws(() => parsePph21Xml('<!DOCTYPE x [<!ENTITY test "x">]><Bp21Bulk/>'), /DOCTYPE/);
  assert.throws(() => parsePph21Xml("<root />"), /Bp21Bulk/);
});
