"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { getTaxAccountLabel } from "@/lib/tax-codes";
import { ReconciliationSummaryRow } from "@/lib/reconciliation";

type SavedPeriod = {
  year: number;
  month: number;
  status: string;
  updatedAt: string;
};

type ReconciliationPeriod = {
  id: number;
  year: number;
  month: number;
  title: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: null | {
    id: number;
    name: string;
    username: string;
    role: string;
  };
  targets: Array<{
    accountCode: string;
    coretaxAmount: number;
  }>;
};

type ReconciliationResponse = {
  selection: {
    year: number;
    month: number;
  };
  period: ReconciliationPeriod | null;
  summary: ReconciliationSummaryRow[];
  totals: {
    coretaxAmount: number;
    doneAmount: number;
    difference: number;
    balancedCount: number;
    overCount: number;
    underCount: number;
  };
  savedPeriods: SavedPeriod[];
};

type EditorRow = {
  id: string;
  accountCode: string;
  coretaxAmount: string;
};

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const monthNamesID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const monthNamesEN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function createEmptyRow(): EditorRow {
  return {
    id: crypto.randomUUID(),
    accountCode: "",
    coretaxAmount: "",
  };
}

export default function ReconciliationPage() {
  const { language, t } = useLanguage();
  const { user, isAdmin, getAuthHeaders, isLoading: isAuthLoading } = useAuth();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editorRows, setEditorRows] = useState<EditorRow[]>([createEmptyRow()]);
  const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const monthNames = language === "ID" ? monthNamesID : monthNamesEN;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/reconciliation?year=${selectedYear}&month=${selectedMonth}`, {
        headers: getAuthHeaders(),
      });
      const payload: ReconciliationResponse & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load reconciliation data.");
      }
      setData(payload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load reconciliation data.";
      setFeedback({ type: "error", message });
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders, selectedMonth, selectedYear]);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    loadData();
  }, [isAuthLoading, loadData, user]);

  useEffect(() => {
    if (!data) return;

    const merged = new Map<string, string>();
    data.period?.targets?.forEach((target) => {
      merged.set(target.accountCode, String(target.coretaxAmount ?? ""));
    });

    data.summary.forEach((row) => {
      if (!merged.has(row.accountCode)) {
        merged.set(row.accountCode, String(row.coretaxAmount ?? ""));
      }
    });

    if (merged.size === 0) {
      setEditorRows([createEmptyRow()]);
    } else {
      setEditorRows(
        Array.from(merged.entries()).map(([accountCode, coretaxAmount]) => ({
          id: crypto.randomUUID(),
          accountCode,
          coretaxAmount,
        }))
      );
    }

    setSelectedAccountCode(data.summary[0]?.accountCode || null);
  }, [data]);

  const selectedSummaryRow = useMemo(() => {
    if (!data?.summary.length) return null;
    return data.summary.find((row) => row.accountCode === selectedAccountCode) || data.summary[0];
  }, [data, selectedAccountCode]);

  const totals = data?.totals || {
    coretaxAmount: 0,
    doneAmount: 0,
    difference: 0,
    balancedCount: 0,
    overCount: 0,
    underCount: 0,
  };

  const periodLabel =
    selectedMonth === "all"
      ? `${selectedYear}`
      : `${monthNames[Number(selectedMonth) - 1]} ${selectedYear}`;

  const handleEditorChange = (id: string, field: "accountCode" | "coretaxAmount", value: string) => {
    setEditorRows((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: field === "accountCode" ? value.toUpperCase() : value,
            }
          : row
      )
    );
  };

  const addEditorRow = () => setEditorRows((rows) => [...rows, createEmptyRow()]);

  const removeEditorRow = (id: string) => {
    setEditorRows((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : [createEmptyRow()]));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const coretaxInputs = editorRows
        .map((row) => ({
          accountCode: row.accountCode.trim(),
          coretaxAmount: Number(row.coretaxAmount),
        }))
        .filter((row) => row.accountCode);

      const res = await fetch("/api/reconciliation", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedYear,
          month: Number(selectedMonth),
          title: `Rekonsiliasi Coretax ${periodLabel}`,
          status: data?.period?.status || "DRAFT",
          targets: coretaxInputs,
        }),
      });

      const payload: ReconciliationResponse & { success?: boolean; error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to save reconciliation data.");
      }

      setFeedback({
        type: "success",
        message:
          language === "ID"
            ? "Rekonsiliasi Coretax berhasil disimpan."
            : "Coretax reconciliation saved successfully.",
      });
      setData(payload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save reconciliation data.";
      setFeedback({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  const summaryColors: Record<string, string> = {
    BALANCED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    OVER: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    UNDER: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header className="flex flex-col gap-2 text-left">
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-3 rounded-2xl bg-accent/10 text-accent">
            <Scale size={28} />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">{t.reconciliation.title}</h1>
            <p className="text-muted-foreground max-w-3xl">{t.reconciliation.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] uppercase tracking-[0.25em] font-black text-muted-foreground">
            {language === "ID" ? "Patokan" : "Basis"} SP2D
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-accent/10 text-accent border border-accent/20">
            Coretax Input vs Mark as Done
          </span>
          {!isAdmin && (
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-muted text-muted-foreground border border-border">
              {t.reconciliation.readonly_hint}
            </span>
          )}
        </div>
      </header>

      <section className="glass-card p-6 md:p-8 flex flex-col gap-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              {t.reconciliation.period_label}
            </label>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-muted/60 border-none rounded-2xl pl-10 pr-10 py-3 text-sm font-bold outline-none appearance-none cursor-pointer"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  size={16}
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-muted/60 border-none rounded-2xl pl-10 pr-10 py-3 text-sm font-bold outline-none appearance-none cursor-pointer min-w-[170px]"
                >
                  {monthNames.map((month, index) => (
                    <option key={month} value={String(index + 1)}>
                      {month}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  size={16}
                />
              </div>
              <button
                onClick={loadData}
                className="px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                {language === "ID" ? "Muat Ulang" : "Reload"}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-1">
            <span className="text-[10px] uppercase font-black tracking-[0.25em] text-muted-foreground">
              {language === "ID" ? "Periode terpilih" : "Selected period"}
            </span>
            <span className="text-lg font-black tracking-tight">{periodLabel}</span>
            <span className="text-xs text-muted-foreground">
              {data?.period?.title || (language === "ID" ? "Belum ada header tersimpan" : "No saved header yet")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 border-accent/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t.reconciliation.total_coretax}
            </p>
            <p className="text-2xl font-black text-foreground mt-2">
              IDR {numberFormatter.format(totals.coretaxAmount)}
            </p>
          </div>
          <div className="glass-card p-5 border-emerald-500/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t.reconciliation.total_done}
            </p>
            <p className="text-2xl font-black text-emerald-500 mt-2">
              IDR {numberFormatter.format(totals.doneAmount)}
            </p>
          </div>
          <div className="glass-card p-5 border-amber-500/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t.reconciliation.total_difference}
            </p>
            <p
              className={`text-2xl font-black mt-2 ${
                totals.difference === 0 ? "text-foreground" : totals.difference > 0 ? "text-amber-500" : "text-rose-500"
              }`}
            >
              IDR {numberFormatter.format(Math.abs(totals.difference))}
              <span className="text-sm font-bold ml-2">
                {totals.difference === 0 ? "" : totals.difference > 0 ? "+" : "-"}
              </span>
            </p>
          </div>
          <div className="glass-card p-5 border-emerald-500/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t.reconciliation.balanced_count}
            </p>
            <p className="text-2xl font-black text-emerald-500 mt-2">{totals.balancedCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2">
              {totals.overCount} {t.reconciliation.over} / {totals.underCount} {t.reconciliation.under}
            </p>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-2xl flex items-start gap-3 border ${
              feedback.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
            )}
            <span className="text-sm font-semibold">{feedback.message}</span>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.9fr] gap-8">
        <div className="glass-card p-6 md:p-8 flex flex-col gap-6 shadow-xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-1 text-left">
              <h2 className="text-xl font-black uppercase tracking-tight">{t.reconciliation.summary_title}</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-black">
                {language === "ID" ? "Klik baris untuk drilldown transaksi" : "Click a row to open the transaction drilldown"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {Object.entries(summaryColors).map(([key, className]) => (
                <span
                  key={key}
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${className}`}
                >
                  {t.reconciliation[key.toLowerCase() as "balanced" | "over" | "under"]}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border/70">
            <table className="premium-table w-full">
              <thead>
                <tr>
                  <th>{language === "ID" ? "Akun Pajak" : "Tax Account"}</th>
                  <th>{t.reconciliation.coretax_label}</th>
                  <th>{t.reconciliation.done_label}</th>
                  <th>{t.reconciliation.difference_label}</th>
                  <th>{language === "ID" ? "Status" : "Status"}</th>
                  <th>{language === "ID" ? "Transaksi" : "Transactions"}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-muted-foreground italic">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16} />
                        {language === "ID" ? "Memuat data rekonsiliasi..." : "Loading reconciliation data..."}
                      </span>
                    </td>
                  </tr>
                ) : data?.summary.length ? (
                  data.summary.map((row) => (
                    <tr
                      key={row.accountCode}
                      className={`cursor-pointer transition-colors ${
                        selectedAccountCode === row.accountCode ? "bg-accent/10" : ""
                      }`}
                      onClick={() => setSelectedAccountCode(row.accountCode)}
                    >
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-sm">{row.accountCode}</span>
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
                            {row.accountLabel}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono">IDR {numberFormatter.format(row.coretaxAmount)}</td>
                      <td className="font-mono text-emerald-500">IDR {numberFormatter.format(row.doneAmount)}</td>
                      <td
                        className={`font-mono ${
                          row.difference === 0 ? "text-foreground" : row.difference > 0 ? "text-amber-500" : "text-rose-500"
                        }`}
                      >
                        IDR {numberFormatter.format(Math.abs(row.difference))}
                        <span className="ml-1 text-[10px] font-black uppercase">
                          {row.difference === 0 ? "" : row.difference > 0 ? "+" : "-"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
                            summaryColors[row.status]
                          }`}
                        >
                          {t.reconciliation[row.status.toLowerCase() as "balanced" | "over" | "under"]}
                        </span>
                      </td>
                      <td className="font-black">{row.transactionCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-muted-foreground italic">
                      {language === "ID"
                        ? "Belum ada data completed pada periode ini."
                        : "No completed data found for this period."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <section className="glass-card p-6 md:p-8 flex flex-col gap-6 shadow-xl">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-1 text-left">
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {language === "ID" ? "Input Nilai Coretax" : "Coretax Amount Input"}
                </h2>
                <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-black">
                  {isAdmin
                    ? language === "ID"
                      ? "Isi nilai Coretax per akun sebelum disimpan"
                      : "Fill Coretax amounts per account before saving"
                    : t.reconciliation.readonly_hint}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={addEditorRow}
                    className="px-4 py-2 rounded-2xl bg-muted/60 hover:bg-muted text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                  >
                    <Plus size={14} />
                    {t.reconciliation.add_row}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="premium-button px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {t.reconciliation.save_period}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {editorRows.map((row, index) => {
                const label = row.accountCode ? getTaxAccountLabel(row.accountCode) : "-";
                return (
                  <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] gap-3 items-center">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {index + 1}. {language === "ID" ? "Kode Akun" : "Account Code"}
                      </label>
                      <input
                        value={row.accountCode}
                        onChange={(e) => handleEditorChange(row.id, "accountCode", e.target.value)}
                        disabled={!isAdmin}
                        placeholder="411121"
                        className="w-full bg-muted/60 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none disabled:opacity-70"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {language === "ID" ? "Label Pajak" : "Tax Label"}
                      </label>
                      <div className="w-full rounded-2xl px-4 py-3 bg-muted/40 border border-border text-sm font-bold">
                        {label}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {t.reconciliation.coretax_label}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.coretaxAmount}
                        onChange={(e) => handleEditorChange(row.id, "coretaxAmount", e.target.value)}
                        disabled={!isAdmin}
                        placeholder="0"
                        className="w-full bg-muted/60 border-none rounded-2xl px-4 py-3 text-sm font-black outline-none disabled:opacity-70"
                      />
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                      {isAdmin && (
                        <button
                          onClick={() => removeEditorRow(row.id)}
                          className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                          title={language === "ID" ? "Hapus baris" : "Remove row"}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-card p-6 md:p-8 flex flex-col gap-6 shadow-xl">
            <div className="flex flex-col gap-1 text-left">
              <h2 className="text-xl font-black uppercase tracking-tight">{t.reconciliation.drilldown_title}</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-black">
                {selectedSummaryRow
                  ? `${selectedSummaryRow.accountCode} · ${selectedSummaryRow.accountLabel}`
                  : t.reconciliation.no_detail}
              </p>
            </div>

            {selectedSummaryRow ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-muted/50 border border-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t.reconciliation.coretax_label}
                    </p>
                    <p className="text-sm font-black mt-1">
                      IDR {numberFormatter.format(selectedSummaryRow.coretaxAmount)}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/50 border border-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t.reconciliation.done_label}
                    </p>
                    <p className="text-sm font-black mt-1 text-emerald-500">
                      IDR {numberFormatter.format(selectedSummaryRow.doneAmount)}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/50 border border-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t.reconciliation.difference_label}
                    </p>
                    <p
                      className={`text-sm font-black mt-1 ${
                        selectedSummaryRow.difference === 0
                          ? "text-foreground"
                          : selectedSummaryRow.difference > 0
                          ? "text-amber-500"
                          : "text-rose-500"
                      }`}
                    >
                      IDR {numberFormatter.format(Math.abs(selectedSummaryRow.difference))}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-border/70">
                  <table className="premium-table w-full">
                    <thead>
                      <tr>
                        <th>{language === "ID" ? "SPM" : "SPM"}</th>
                        <th>{language === "ID" ? "SP2D" : "SP2D"}</th>
                        <th>{language === "ID" ? "Penerima" : "Recipient"}</th>
                        <th>{language === "ID" ? "Nominal" : "Amount"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSummaryRow.records.length ? (
                        selectedSummaryRow.records.map((record) => (
                          <tr key={record.id}>
                            <td>
                              <div className="flex flex-col gap-1">
                                <span className="font-black text-sm">{record.spmNumber}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                  {record.accountCode}
                                </span>
                              </div>
                            </td>
                            <td className="font-mono">
                              {record.sp2dNumber || "-"}
                              <div className="text-[10px] text-muted-foreground font-black mt-1">
                                {record.sp2dDate
                                  ? new Date(record.sp2dDate).toLocaleDateString(
                                      language === "ID" ? "id-ID" : "en-US",
                                      {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      }
                                    )
                                  : "-"}
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold">{record.recipient || "-"}</span>
                                <span className="text-[10px] text-muted-foreground italic line-clamp-2">
                                  {record.description || "-"}
                                </span>
                              </div>
                            </td>
                            <td className="font-black text-emerald-500">
                              IDR {numberFormatter.format(record.doneAmount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground italic">
                            {language === "ID"
                              ? "Tidak ada transaksi detail untuk akun ini."
                              : "No transaction details available for this account."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="min-h-[220px] flex items-center justify-center text-muted-foreground italic text-sm">
                {t.reconciliation.no_detail}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
