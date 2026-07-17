import assert from "node:assert/strict";
import test from "node:test";
import { buildMmPayrollXml, buildPph21Xml, calculateMmPayrollTax, calculatePph21Tax, getPtkpTerCategory, normalizePph21Lines, normalizePtkpStatus, parseMmPayrollXml, parsePph21Xml } from "../src/lib/pph21.ts";

test("maps supported tax objects and rounds each calculated tax", () => {
  const lines = normalizePph21Lines([
    { nik: "1277014308900003", name: "Penerima Satu", taxObjectCode: "21-100-07", gross: 101 },
    { nik: "3275020507890029", name: "Penerima Dua", taxObjectCode: "21-402-03", gross: 1000 },
  ]);
  assert.equal(lines[0].deemed, 50);
  assert.equal(lines[0].calculatedTax, 3);
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

test("parses MmPayroll XML and calculates payroll tax from gross and rate", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MmPayrollBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <TIN>0001861061012000</TIN>
  <ListOfMmPayroll>
    <MmPayroll>
      <TaxPeriodMonth>6</TaxPeriodMonth>
      <TaxPeriodYear>2026</TaxPeriodYear>
      <CounterpartOpt>Resident</CounterpartOpt>
      <CounterpartPassport xsi:nil="true"/>
      <CounterpartTin>3275090906680014</CounterpartTin>
      <StatusTaxExemption>TK/0</StatusTaxExemption>
      <Position>STAFF</Position>
      <TaxCertificate>N/A</TaxCertificate>
      <TaxObjectCode>21-100-01</TaxObjectCode>
      <Gross>10405710</Gross>
      <Rate>2.5</Rate>
      <IDPlaceOfBusinessActivity>0001861061012000000000</IDPlaceOfBusinessActivity>
      <WithholdingDate>2026-06-04</WithholdingDate>
    </MmPayroll>
  </ListOfMmPayroll>
</MmPayrollBulk>`;

  const imported = parseMmPayrollXml(xml);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].counterpartTin, "3275090906680014");
  assert.equal(imported[0].calculatedTax, 260143);
  assert.equal(imported[0].calculatedTax, calculateMmPayrollTax(10405710, 2.5));
});

test("maps PTKP statuses to TER categories and rejects HB", () => {
  assert.equal(normalizePtkpStatus(" tk/0 "), "TK/0");
  assert.equal(getPtkpTerCategory("TK/0"), "A");
  assert.equal(getPtkpTerCategory("K/I/0"), "A");
  assert.equal(getPtkpTerCategory("K/2"), "B");
  assert.equal(getPtkpTerCategory("K/3"), "C");
  assert.equal(getPtkpTerCategory("HB/0"), null);
});

test("builds MmPayroll XML with non-final defaults", () => {
  const xml = buildMmPayrollXml([
    {
      taxPeriodMonth: 6,
      taxPeriodYear: 2026,
      counterpartTin: "3275090906680014",
      statusTaxExemption: "TK/0",
      gross: 10405710,
      rate: 2.5,
      withholdingDate: new Date("2026-06-04T00:00:00.000Z"),
    },
  ]);

  assert.match(xml, /<MmPayrollBulk/);
  assert.match(xml, /<CounterpartOpt>Resident<\/CounterpartOpt>/);
  assert.match(xml, /<CounterpartTin>3275090906680014<\/CounterpartTin>/);
  assert.match(xml, /<StatusTaxExemption>TK\/0<\/StatusTaxExemption>/);
  assert.match(xml, /<Position>STAFF<\/Position>/);
  assert.match(xml, /<TaxCertificate>N\/A<\/TaxCertificate>/);
  assert.match(xml, /<TaxObjectCode>21-100-01<\/TaxObjectCode>/);
  assert.match(xml, /<IDPlaceOfBusinessActivity>0001861061012000000000<\/IDPlaceOfBusinessActivity>/);
  assert.match(xml, /<CounterpartPassport xsi:nil="true"\/>/);

  const imported = parseMmPayrollXml(xml);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].calculatedTax, 260143);
  assert.equal(imported[0].calculatedTax, calculateMmPayrollTax(10405710, 2.5));
});
