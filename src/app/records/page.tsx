"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { 
  Search, Filter, ChevronDown, Calendar, 
  Clock, ArrowUpDown, Check, 
  ExternalLink, X, ClipboardCheck,
  ChevronsLeft, ChevronsRight,
  User, CheckCircle2, FileText, Hash,
  Landmark, Download, FileJson, Table, FileType, Upload,
  CalendarRange, AlertCircle, RefreshCw, Loader2, Plus, Trash2, Save
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { getTaxAccountLabel } from "@/lib/tax-codes";
import { buildPph21ExportFileName, PPH21_TAX_OBJECT_LABELS, PPH21_TAX_OBJECTS } from "@/lib/pph21";
import { SPMRecord, Colleague } from "@/types";
import { TableSkeletonRows } from "@/components/TableSkeleton";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

type Pph21TaxCode = keyof typeof PPH21_TAX_OBJECTS;
type Pph21Line = { clientId: string; nik: string; name: string; taxObjectCode: Pph21TaxCode; gross: string };
type Pph21RecipientOption = { id: number; nik: string; name: string; defaultTaxObjectCode: Pph21TaxCode };

type Pph21ModalRecord = SPMRecord & {
  pph21Batch?: {
    id: number;
    status: string;
    issueNotes?: string | null;
    withholdingDate?: string | null;
    withholdings?: Array<{
      id: number;
      recipientName: string;
      taxObjectCode: string;
      gross: number;
      calculatedTax: number;
      recipient?: { nik: string; name: string } | null;
    }>;
  } | null;
};
type ImportReport = {
  fileName: string;
  totalRows: number;
  totalDocuments: number;
  importedCount: number;
  matchCount: number;
  mismatchCount: number;
  notFoundCount: number;
  groups: Array<{
    documentNumber: string;
    spmNumber: string | null;
    recipientCount: number;
    xmlGross: number;
    xmlTax: number;
    sp2dDeduction: number | null;
    difference: number | null;
    status: "IMPORTED" | "MISMATCH" | "NOT_FOUND" | "ALREADY_FILLED" | "FORBIDDEN" | "INVALID_DATES";
  }>;
};
type PayrollImportSummary = {
  fileName: string;
  totalRows: number;
  uniqueRecipients: number;
  totalGross: number;
  totalTax: number;
  taxPeriodMonth: number | null;
  taxPeriodYear: number | null;
  withholdingDate: string | null;
};
type PayrollImportRecord = Pick<SPMRecord, "id" | "spmNumber" | "sp2dNumber" | "sp2dDate" | "recipient" | "description" | "deductionAmount" | "accountCode" | "status" | "totalValue">;
type MonitoringImportRow = {
  rowNumber: number;
  noSp2d: string;
  tanggalSp2d: string;
  jenisSpm: string;
  jumlah: number;
  namaPenerima: string;
  deskripsi: string;
  isEligible: boolean;
  excludeReason: string | null;
  matchedRecipientName: string | null;
};
type MonitoringImportSummary = {
  fileName: string;
  totalRows: number;
  eligibleRows: number;
  excludedRows: number;
  totalEligibleAmount: number;
  uniqueRecipients: number;
  rows: MonitoringImportRow[];
};

const formatGrossInput = (value: string) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
};

const createPph21Line = (): Pph21Line => ({
  clientId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  nik: "",
  name: "",
  taxObjectCode: "21-402-02",
  gross: "",
});

const sortPph21RecordsForExport = <T extends { sp2dDate?: string | null; sp2dNumber?: string | null }>(records: T[]) => {
  return [...records].sort((a, b) => {
    const aDate = a.sp2dDate ? new Date(a.sp2dDate).getTime() : Number.POSITIVE_INFINITY;
    const bDate = b.sp2dDate ? new Date(b.sp2dDate).getTime() : Number.POSITIVE_INFINITY;
    if (aDate !== bDate) return aDate - bDate;
    return (a.sp2dNumber || "").localeCompare(b.sp2dNumber || "");
  });
};

export default function RecordsPage() {
  const { language, t } = useLanguage();
  const { user, getAuthHeaders } = useAuth();
  
  const [records, setRecords] = useState<SPMRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [pph21Recipients, setPph21Recipients] = useState<Pph21RecipientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Sorting states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pph21ProcessFilter, setPph21ProcessFilter] = useState<"all" | "PENDING" | "DATA_ENTERED" | "COMPLETED" | "ISSUES">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | "max">(25);

  const [selectedRecord, setSelectedRecord] = useState<SPMRecord | null>(null);
  const [selectedPph21Record, setSelectedPph21Record] = useState<Pph21ModalRecord | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPph21DetailLoading, setIsPph21DetailLoading] = useState(false);
  const [isPph21EditorOpen, setIsPph21EditorOpen] = useState(false);
  const [isPph21Saving, setIsPph21Saving] = useState(false);
  const [isPph21XmlDownloading, setIsPph21XmlDownloading] = useState(false);
  const [isPph21XmlExporting, setIsPph21XmlExporting] = useState(false);
  const [isImportingXml, setIsImportingXml] = useState(false);
  const [isMonitoringImportOpen, setIsMonitoringImportOpen] = useState(false);
  const [isMonitoringImporting, setIsMonitoringImporting] = useState(false);
  const [isPayrollImportOpen, setIsPayrollImportOpen] = useState(false);
  const [isPayrollXmlImporting, setIsPayrollXmlImporting] = useState(false);
  const [pph21SaveError, setPph21SaveError] = useState("");
  const [pph21WithholdingDate, setPph21WithholdingDate] = useState("");
  const [pph21Lines, setPph21Lines] = useState<Pph21Line[]>([createPph21Line()]);
  const [updateForm, setUpdateForm] = useState<{ docLink: string, notes: string, status: "COMPLETED" | "ISSUES" }>({ docLink: "", notes: "", status: "COMPLETED" });
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const pph21RowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pph21ImportInputRef = useRef<HTMLInputElement | null>(null);
  const monitoringImportInputRef = useRef<HTMLInputElement | null>(null);
  const payrollImportInputRef = useRef<HTMLInputElement | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState("");
  const [monitoringImportSummary, setMonitoringImportSummary] = useState<MonitoringImportSummary | null>(null);
  const [monitoringImportError, setMonitoringImportError] = useState("");
  const [payrollImportSummary, setPayrollImportSummary] = useState<PayrollImportSummary | null>(null);
  const [payrollImportError, setPayrollImportError] = useState("");
  const [payrollImportRecords, setPayrollImportRecords] = useState<PayrollImportRecord[]>([]);
  const [payrollRecordQuery, setPayrollRecordQuery] = useState("");
  const [selectedPayrollRecordId, setSelectedPayrollRecordId] = useState<number | null>(null);

  const getPph21BadgeClass = (status?: string | null) => {
    if (status === "COMPLETED") return "badge-completed";
    if (status === "DATA_ENTERED") return "bg-amber-500/10! text-amber-500! border-amber-500/20!";
    if (status === "ISSUES") return "bg-amber-500/10! text-amber-500! border-amber-500/20!";
    return "badge-pending";
  };
  const getPph21StatusLabel = (status?: string | null) => {
    switch (status || "PENDING") {
      case "PENDING":
        return "Pending";
      case "DATA_ENTERED":
        return "Draft";
      case "COMPLETED":
        return "Completed";
      case "ISSUES":
        return "Issues";
      default:
        return status || "PENDING";
    }
  };
  const getPph21ProcessLabel = (status?: string | null) => {
    switch (status || "PENDING") {
      case "PENDING":
        return "Pending";
      case "DATA_ENTERED":
        return "Data Entered";
      case "COMPLETED":
        return "Completed";
      case "ISSUES":
        return "Issues";
      default:
        return status || "PENDING";
    }
  };

  const filteredAndSortedRecords = records;
  const paginatedRecords = records;

  const totalPages = useMemo(() => {
    if (rowsPerPage === "max") return 1;
    return Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  }, [totalRecords, rowsPerPage]);

  const isAllOnPageSelected = useMemo(() => {
    if (paginatedRecords.length === 0) return false;
    return paginatedRecords.every(r => selectedIds.has(r.id));
  }, [paginatedRecords, selectedIds]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), pageSize: String(rowsPerPage) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (accountFilter !== "all") params.set("accountCode", accountFilter);
      if (assigneeFilter !== "all") params.set("assigneeId", assigneeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (pph21ProcessFilter !== "all") params.set("pph21Process", pph21ProcessFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (sortConfig) { params.set("sortKey", sortConfig.key); params.set("sortDirection", sortConfig.direction); }
      const recRes = await fetch(`/api/records?${params}`);
      const recData = await recRes.json();
      setRecords(recData.records || []);
      setTotalRecords(recData.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [accountFilter, assigneeFilter, currentPage, debouncedSearch, endDate, pph21ProcessFilter, rowsPerPage, sortConfig, startDate, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void fetch("/api/colleagues").then((res) => res.json()).then(setColleagues).catch(console.error);
  }, []);

  useEffect(() => {
    void fetch("/api/pph21/recipients", { headers: getAuthHeaders() })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setPph21Recipients(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [getAuthHeaders]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const openUpdateModal = async (record: SPMRecord) => {
    setSelectedRecord(record);
    setSelectedPph21Record(null);
    setPph21SaveError("");
    setIsPph21EditorOpen(record.accountCode === "411121");
    setUpdateForm({ docLink: record.docLink || "", notes: record.notes || "", status: record.status === "ISSUES" ? "ISSUES" : "COMPLETED" });
    setIsUpdateModalOpen(true);
    if (record.accountCode !== "411121") return;
    setIsPph21DetailLoading(true);
    try {
      const res = await fetch(`/api/pph21?recordId=${record.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedPph21Record(data);
        setPph21WithholdingDate(data.pph21Batch?.withholdingDate?.slice(0, 10) || record.sp2dDate?.slice(0, 10) || "");
        setPph21Lines(
          data.pph21Batch?.withholdings?.length
            ? data.pph21Batch.withholdings.map((item: { recipient: { nik: string } | null; recipientName: string; taxObjectCode: Pph21TaxCode; gross: number }) => ({
                clientId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
                nik: item.recipient?.nik || "",
                name: item.recipientName,
                taxObjectCode: item.taxObjectCode,
                gross: String(item.gross),
              }))
            : [createPph21Line()],
        );
        setIsPph21EditorOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPph21DetailLoading(false);
    }
  };

  const openDetailModal = (record: SPMRecord) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
    setSelectedPph21Record(null);
    if (record.accountCode === "411121") {
      setIsPph21DetailLoading(true);
      void fetch(`/api/pph21?recordId=${record.id}`, { headers: getAuthHeaders() })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) setSelectedPph21Record(data);
        })
        .catch(console.error)
        .finally(() => setIsPph21DetailLoading(false));
    }
  };

  const submitUpdate = async () => {
    if (!selectedRecord) return;
    try {
      const res = await fetch("/api/records", {
        method: "PATCH",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: selectedRecord.id, ...updateForm }),
      });
      if (res.ok) {
        fetchData();
        setIsUpdateModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch("/api/records", {
        method: "PATCH",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const assignColleague = async (id: number, assigneeId: number | null) => {
    try {
      const res = await fetch("/api/records", {
        method: "PATCH",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, assigneeId: assigneeId === 0 ? null : assigneeId }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkAssign = async (assigneeId: number | null) => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/records", {
        method: "PATCH",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          ids: Array.from(selectedIds), 
          assigneeId: assigneeId === 0 ? null : assigneeId 
        }),
      });
      if (res.ok) {
        fetchData();
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentIds = paginatedRecords.map(r => r.id);
      setSelectedIds(new Set([...selectedIds, ...currentIds]));
    } else {
      const currentIds = paginatedRecords.map(r => r.id);
      const newSelected = new Set(selectedIds);
      currentIds.forEach(id => newSelected.delete(id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelectRecord = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const getDeadlineStatus = (record: SPMRecord) => {
    if (!record.sp2dDate) return { label: "N/A", status: "neutral", date: null, type: "neutral" };
    const sp2dDate = new Date(record.sp2dDate);
    const targetDate = new Date(sp2dDate.getFullYear(), sp2dDate.getMonth() + 1, 15);
    
    if (record.status === "COMPLETED" && record.completionDate) {
      const doneAt = new Date(record.completionDate);
      const isOnTime = doneAt <= targetDate;
      return { 
        label: isOnTime ? (language === "ID" ? "Tepat Waktu" : "On Time") : (language === "ID" ? "Terlambat" : "Late"), 
        type: isOnTime ? "ok" : "overdue", 
        status: isOnTime ? "ok" : "overdue",
        date: targetDate 
      };
    }

    const today = new Date();
    const diff = targetDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diff / (1000 * 3600 * 24));
    if (daysLeft < 0) return { label: `${t.worksheet.terlewat} (${Math.abs(daysLeft)} ${t.worksheet.days_overdue})`, type: "overdue", status: "overdue", date: targetDate };
    if (daysLeft < 5) return { label: `${t.worksheet.segera} (${daysLeft} ${t.worksheet.days_left})`, type: "soon", status: "soon", date: targetDate };
    return { label: `Target: ${targetDate.toLocaleDateString(language === "ID" ? "id-ID" : "en-US", { day: 'numeric', month: 'long', year: 'numeric' })}`, type: "ok", status: "ok", date: targetDate };
  };

  const uniqueAccounts = ["411121", "411122", "411124", "411128", "811147"];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, accountFilter, assigneeFilter, statusFilter, pph21ProcessFilter, startDate, endDate, sortConfig]);

  // Export Functions
  const exportToExcel = () => {
    const data = filteredAndSortedRecords.map(r => ({
      SPM: r.spmNumber,
      Tanggal_SPM: new Date(r.spmDate).toLocaleDateString(),
      Uraian_SPM: r.description || "-",
      Nomor_SP2D: r.sp2dNumber || "-",
      Tanggal_SP2D: r.sp2dDate ? new Date(r.sp2dDate).toLocaleDateString() : (language === "ID" ? "Belum Terbit" : "Not Issued"),
      Account: r.accountCode,
      Potongan_Pajak: r.deductionAmount,
      Nilai_Pembayaran: r.totalValue || 0,
      Penerima: r.recipient,
      Status: r.status,
      Petugas: colleagues.find(c => c.id === r.assigneeId)?.name || 'Unassigned'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Records");
    XLSX.writeFile(wb, `Bupot_PANRB_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    const headers = ["SPM", "Tanggal SPM", "Uraian SPM", "Nomor SP2D", "Tanggal SP2D", "Account", "Potongan Pajak", "Nilai Pembayaran", "Penerima", "Status", "Petugas"];
    const rows = filteredAndSortedRecords.map(r => [
      r.spmNumber,
      new Date(r.spmDate).toLocaleDateString(),
      r.description || "-",
      r.sp2dNumber || "-",
      r.sp2dDate ? new Date(r.sp2dDate).toLocaleDateString() : (language === "ID" ? "Belum Terbit" : "Not Issued"),
      r.accountCode,
      r.deductionAmount,
      r.totalValue || 0,
      r.recipient || "",
      r.status,
      colleagues.find(c => c.id === r.assigneeId)?.name || "Unassigned"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bupot_PANRB_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    const headers = [["SPM", "SPM Date", "SP2D No", "SP2D Date", "Account", "Tax", "Payment", "Status"]];
    const data = filteredAndSortedRecords.map(r => [
      r.spmNumber,
      new Date(r.spmDate).toLocaleDateString(),
      r.sp2dNumber || "-",
      r.sp2dDate ? new Date(r.sp2dDate).toLocaleDateString() : "-",
      r.accountCode,
      r.deductionAmount.toLocaleString(),
      (r.totalValue || 0).toLocaleString(),
      r.status
    ]);

    doc.text("Bupot PANRB - Worksheet Report", 40, 40);
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 60,
      theme: 'grid',
      styles: { fontSize: 8 }
    });
    doc.save(`Bupot_PANRB_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const SortHeader = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => (
    <th className={`cursor-pointer hover:bg-black/10 dark:hover:bg-white/5 transition-colors group p-4 ${className}`} onClick={() => handleSort(sortKey)}>
      <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground/80">
        {label}
        <ArrowUpDown size={12} className={`transition-opacity ${sortConfig?.key === sortKey ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-40"}`} />
      </div>
    </th>
  );

  const resetFilters = () => {
    setSearchQuery("");
    setAccountFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
    setPph21ProcessFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const pph21TaxTotal = useMemo(() => {
    return pph21Lines.reduce((sum, line) => {
      const rule = PPH21_TAX_OBJECTS[line.taxObjectCode];
      return sum + Math.round((Number(line.gross) || 0) * rule.deemed / 100 * rule.rate / 100);
    }, 0);
  }, [pph21Lines]);

  const monitoringEligibleSet = useMemo(() => new Set([
    "GAJI INDUK",
    "GAJI LAINNYA",
    "GAJI LAINNYA PPPK",
    "GAJI PPPK INDUK",
    "GAJI SUSULAN",
    "KEKURANGAN GAJI",
    "KEKURANGAN TUNJANGAN KINERJA",
    "SPM GAJI 13 TUNKIN",
    "SPM GAJI 13 PNS/TNI/POLRI",
    "SPM GAJI 13 PPPK",
    "SPM GAJI 13 PEJABAT NEGARA",
    "TUNJANGAN KINERJA SUSULAN",
    "PENGHASILAN PPNPN INDUK",
  ]), []);

  const selectedPph21Ids = useMemo(() => {
    return Array.from(selectedIds).filter((id) => records.find((record) => record.id === id)?.accountCode === "411121");
  }, [records, selectedIds]);

  const selectedPph21Records = useMemo(() => {
    const selectedIdSet = new Set(selectedPph21Ids);
    const selectedRecordsForExport = records
      .filter((record) => selectedIdSet.has(record.id))
      .map((record) => ({
        ...record,
        sp2dDate: record.sp2dDate ?? null,
        sp2dNumber: record.sp2dNumber ?? null,
      }));

    return sortPph21RecordsForExport(selectedRecordsForExport);
  }, [records, selectedPph21Ids]);

  const selectedPph21TaxTotal = useMemo(() => {
    return selectedPph21Record?.pph21Batch?.withholdings?.reduce((sum, line) => sum + line.calculatedTax, 0) || 0;
  }, [selectedPph21Record]);

  const pph21ErrorRow = useMemo(() => {
    const match = pph21SaveError.match(/baris\s+(\d+)/i);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isInteger(value) && value > 0 ? value : null;
  }, [pph21SaveError]);

  const filteredPayrollImportRecords = useMemo(() => {
    const query = payrollRecordQuery.trim().toLowerCase();
    if (!query) return payrollImportRecords;
    const normalizedQuery = query.replace(/\D/g, "");
    return payrollImportRecords.filter((record) => {
      const searchableValues = [
        record.spmNumber,
        record.sp2dNumber,
        record.recipient,
        record.description,
        record.accountCode,
        record.status,
        record.totalValue != null ? new Intl.NumberFormat("id-ID").format(record.totalValue) : "",
        record.deductionAmount != null ? new Intl.NumberFormat("id-ID").format(record.deductionAmount) : "",
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      if (searchableValues.includes(query)) return true;
      if (normalizedQuery) {
        const numericValues = [
          record.totalValue,
          record.deductionAmount,
        ]
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
          .map((value) => String(Math.round(value)).replace(/\D/g, ""));

        return numericValues.some((value) => value.includes(normalizedQuery));
      }

      return searchableValues.includes(query);
    });
  }, [payrollImportRecords, payrollRecordQuery]);

  const selectedPayrollRecord = useMemo(() => {
    return payrollImportRecords.find((record) => record.id === selectedPayrollRecordId) || null;
  }, [payrollImportRecords, selectedPayrollRecordId]);

  const payrollAutoMatchedRecord = useMemo(() => {
    if (!payrollImportSummary) return null;
    return payrollImportRecords.find((record) => record.deductionAmount === payrollImportSummary.totalTax) || null;
  }, [payrollImportRecords, payrollImportSummary]);

  const payrollImportComparison = useMemo(() => {
    if (!payrollImportSummary || !selectedPayrollRecord) return null;
    const difference = payrollImportSummary.totalTax - selectedPayrollRecord.deductionAmount;
    return {
      difference,
      isMatch: difference === 0,
    };
  }, [payrollImportSummary, selectedPayrollRecord]);

  useEffect(() => {
    if (!isPph21EditorOpen || !pph21ErrorRow) return;
    const row = pph21RowRefs.current[pph21ErrorRow - 1];
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isPph21EditorOpen, pph21ErrorRow]);

  useEffect(() => {
    if (!isPayrollImportOpen || !payrollImportSummary || !payrollImportRecords.length) return;
    if (payrollAutoMatchedRecord) {
      setSelectedPayrollRecordId(payrollAutoMatchedRecord.id);
      return;
    }
    setSelectedPayrollRecordId((current) => (current && payrollImportRecords.some((record) => record.id === current) ? current : null));
  }, [isPayrollImportOpen, payrollAutoMatchedRecord, payrollImportRecords, payrollImportSummary]);

  const isPph21XmlReady = useMemo(() => {
    if (!selectedRecord || selectedRecord.accountCode !== "411121") return false;
    if (selectedPph21Record?.pph21Batch?.status === "ISSUES") return false;
    if (!selectedPph21Record?.pph21Batch?.withholdingDate) return false;
    if (!selectedPph21Record?.pph21Batch?.withholdings?.length) return false;
    return selectedPph21TaxTotal === selectedRecord.deductionAmount;
  }, [selectedPph21Record, selectedPph21TaxTotal, selectedRecord]);

  const normalizeRecipientQuery = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

  const choosePph21Recipient = (index: number, value: string, field: "nik" | "name") => {
    const normalized = normalizeRecipientQuery(value);
    const recipient =
      field === "nik"
        ? pph21Recipients.find((item) => normalizeRecipientQuery(item.nik) === normalized)
        : pph21Recipients.find((item) => normalizeRecipientQuery(item.name) === normalized);
    setPph21Lines((current) => current.map((line, i) => i === index ? {
      ...line,
      nik: recipient ? recipient.nik : (field === "nik" ? value : line.nik),
      name: recipient ? recipient.name : (field === "nik" ? "" : value),
      taxObjectCode: recipient?.defaultTaxObjectCode || line.taxObjectCode,
    } : line));
  };

  const savePph21FromRecords = async () => {
    if (!selectedRecord || selectedRecord.accountCode !== "411121") return;
    setIsPph21Saving(true);
    setPph21SaveError("");
    try {
      const res = await fetch("/api/pph21", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId: selectedRecord.id,
          withholdingDate: pph21WithholdingDate,
          lines: pph21Lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan rincian PPh 21");
      const detailRes = await fetch(`/api/pph21?recordId=${selectedRecord.id}`, { headers: getAuthHeaders() });
      if (detailRes.ok) {
        setSelectedPph21Record(await detailRes.json());
      }
      setIsPph21EditorOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      setPph21SaveError(error instanceof Error ? error.message : "Gagal menyimpan rincian PPh 21");
    } finally {
      setIsPph21Saving(false);
    }
  };

  const checkImportedXml = async (file: File) => {
    setIsImportingXml(true);
    setImportError("");
    setImportReport(null);
    try {
      const formData = new FormData();
      formData.append("xml", file);
      const res = await fetch("/api/pph21/import", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memeriksa XML");
      setImportReport(data);
      fetchData();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Gagal memeriksa XML");
    } finally {
      setIsImportingXml(false);
    }
  };

  const normalizeMonitoringHeader = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const normalizeMonitoringText = (value: unknown) => String(value ?? "").trim();
  const parseMonitoringAmount = (value: unknown) => {
    if (typeof value === "number") return value;
    const cleaned = String(value ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const parseMonitoringDate = (value: unknown) => {
    if (value instanceof Date) return value;
    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d) : null;
    }
    const text = String(value ?? "").trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const parsed = new Date(text);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parts = text.split(/[\/.-]/).map((part) => Number(part));
    if (parts.length === 3 && parts.every((part) => Number.isInteger(part))) {
      const [day, month, year] = parts;
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const classifyMonitoringRow = (jenisSpm: string, namaPenerima: string) => {
    const normalizedJenis = normalizeMonitoringHeader(jenisSpm);
    const normalizedNama = normalizeMonitoringHeader(namaPenerima);
    if (!normalizedJenis) return { isEligible: false, excludeReason: "Jenis SPM kosong" };
    if (normalizedJenis.includes("NON GAJI")) return { isEligible: false, excludeReason: "NON GAJI dikecualikan" };
    if (normalizedJenis.includes("BPG")) return { isEligible: false, excludeReason: "BPG/bendahara dikecualikan" };
    if (normalizedJenis.includes("KONTRAKTUAL")) return { isEligible: false, excludeReason: "Kontraktual dikecualikan" };
    const eligible = Array.from(monitoringEligibleSet).some((keyword) => normalizedJenis.includes(keyword));
    if (!eligible) return { isEligible: false, excludeReason: "Jenis SPM belum masuk allowlist non-final" };
    if (normalizedNama.includes("BPG")) return { isEligible: false, excludeReason: "Penerima BPG/bendahara dikecualikan" };
    return { isEligible: true, excludeReason: null };
  };

  const parseMonitoringWorkbook = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets.SPANExt || workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("Sheet SPANExt tidak ditemukan");
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
    const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeMonitoringHeader(cell) === "NO SP2D") && row.some((cell) => normalizeMonitoringHeader(cell) === "TANGGAL SP2D"));
    if (headerIndex < 0) throw new Error("Baris header monitoring SP2D tidak ditemukan");
    const headerRow = rows[headerIndex];
    const columnMap = new Map<string, number>();
    headerRow.forEach((cell, index) => columnMap.set(normalizeMonitoringHeader(cell), index));
    const get = (row: unknown[], key: string) => {
      const idx = columnMap.get(key);
      return idx === undefined ? "" : row[idx];
    };
    const parsedRows: MonitoringImportRow[] = [];
    for (let i = headerIndex + 1; i < rows.length; i += 1) {
      const row = rows[i];
      const noSp2d = normalizeMonitoringText(get(row, "NO SP2D"));
      const tanggal = parseMonitoringDate(get(row, "TANGGAL SP2D"));
      const jenisSpm = normalizeMonitoringText(get(row, "JENIS SPM"));
      const jumlah = parseMonitoringAmount(get(row, "JUMLAH"));
      const namaPenerima = normalizeMonitoringText(get(row, "NAMA PENERIMA"));
      const deskripsi = normalizeMonitoringText(get(row, "DESKRIPSI"));
      if (!noSp2d && !jenisSpm && !namaPenerima && !jumlah) continue;
      const classification = classifyMonitoringRow(jenisSpm, namaPenerima);
      const matchedRecipient = pph21Recipients.find((recipient) =>
        recipient.name.trim().toLowerCase() === namaPenerima.trim().toLowerCase() ||
        recipient.name.trim().toLowerCase() === namaPenerima.replace(/^Penerima\s*:\s*/i, "").trim().toLowerCase()
      ) || null;
      parsedRows.push({
        rowNumber: i + 1,
        noSp2d,
        tanggalSp2d: tanggal ? tanggal.toISOString().slice(0, 10) : "",
        jenisSpm,
        jumlah,
        namaPenerima,
        deskripsi,
        isEligible: classification.isEligible,
        excludeReason: classification.excludeReason,
        matchedRecipientName: matchedRecipient?.name || null,
      });
    }
    const eligibleRows = parsedRows.filter((row) => row.isEligible);
    return {
      fileName: file.name,
      totalRows: parsedRows.length,
      eligibleRows: eligibleRows.length,
      excludedRows: parsedRows.length - eligibleRows.length,
      totalEligibleAmount: eligibleRows.reduce((sum, row) => sum + row.jumlah, 0),
      uniqueRecipients: new Set(eligibleRows.map((row) => row.matchedRecipientName || row.namaPenerima)).size,
      rows: parsedRows,
    } satisfies MonitoringImportSummary;
  };

  const openMonitoringImport = async () => {
    setIsMonitoringImportOpen(true);
    setMonitoringImportError("");
    setMonitoringImportSummary(null);
  };

  const closeMonitoringImport = () => {
    setIsMonitoringImportOpen(false);
    setMonitoringImportError("");
    setMonitoringImportSummary(null);
  };

  const checkMonitoringWorkbook = async (file: File) => {
    setIsMonitoringImporting(true);
    setMonitoringImportError("");
    setMonitoringImportSummary(null);
    try {
      const summary = await parseMonitoringWorkbook(file);
      setMonitoringImportSummary(summary);
    } catch (error) {
      setMonitoringImportError(error instanceof Error ? error.message : "Gagal memeriksa monitoring SP2D");
    } finally {
      setIsMonitoringImporting(false);
    }
  };

  const loadPayrollImportRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "max", sortKey: "sp2d", sortDirection: "desc", compact: "1" });
      const res = await fetch(`/api/records?${params}`);
      const data = await res.json();
      setPayrollImportRecords(Array.isArray(data.records) ? data.records.filter((record: PayrollImportRecord) => record.status !== "COMPLETED") : []);
    } catch (error) {
      console.error(error);
      setPayrollImportRecords([]);
    }
  }, []);

  const openPayrollImport = async () => {
    setIsPayrollImportOpen(true);
    setPayrollImportError("");
    setPayrollImportSummary(null);
    setPayrollRecordQuery("");
    setSelectedPayrollRecordId(null);
    await loadPayrollImportRecords();
  };

  const closePayrollImport = () => {
    setIsPayrollImportOpen(false);
    setPayrollImportSummary(null);
    setPayrollImportError("");
    setPayrollImportRecords([]);
    setPayrollRecordQuery("");
    setSelectedPayrollRecordId(null);
  };

  const checkPayrollXml = async (file: File) => {
    setIsPayrollXmlImporting(true);
    setPayrollImportError("");
    setPayrollImportSummary(null);
    try {
      const formData = new FormData();
      formData.append("xml", file);
      const res = await fetch("/api/pph21/import/payroll", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memeriksa XML Non-Final");
      setPayrollImportSummary(data);
    } catch (error) {
      setPayrollImportError(error instanceof Error ? error.message : "Gagal memeriksa XML Non-Final");
    } finally {
      setIsPayrollXmlImporting(false);
    }
  };

  const downloadPph21XmlFromRecords = async () => {
    if (!selectedRecord || selectedRecord.accountCode !== "411121" || !isPph21XmlReady) return;
    setIsPph21XmlDownloading(true);
    try {
      const res = await fetch("/api/pph21/export", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordIds: [selectedRecord.id] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal mengunduh XML PPh 21");
      }

      const blob = await res.blob();
      const fallbackFileName = buildPph21ExportFileName(
        [{ spmNumber: selectedRecord.spmNumber, sp2dNumber: selectedRecord.sp2dNumber }],
        user?.name || "petugas",
      );
      const resolvedFileName = res.headers.get("X-Export-Filename") || fallbackFileName;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = resolvedFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const detailRes = await fetch(`/api/pph21?recordId=${selectedRecord.id}`, { headers: getAuthHeaders() });
      if (detailRes.ok) {
        setSelectedPph21Record(await detailRes.json());
      }
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsPph21XmlDownloading(false);
    }
  };

  const exportSelectedPph21Xml = async () => {
    if (selectedPph21Ids.length === 0) return;
    setIsPph21XmlExporting(true);
    try {
      const res = await fetch("/api/pph21/export", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordIds: selectedPph21Ids }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal mengekspor XML PPh 21");
      }

      const blob = await res.blob();
      const fallbackFileName = buildPph21ExportFileName(
        selectedPph21Records.map((record) => ({ spmNumber: record.spmNumber, sp2dNumber: record.sp2dNumber })),
        user?.name || "petugas",
      );
      const fileName = res.headers.get("X-Export-Filename") || fallbackFileName;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsPph21XmlExporting(false);
    }
  };

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-8 pb-10">
      {/* Update/Completion Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-1000">
          <div className="glass-card bg-white/95! dark:bg-card/70! p-6 md:p-8 rounded-3xl w-[96vw] max-w-7xl max-h-[95vh] overflow-y-auto flex flex-col gap-6 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center text-left">
              <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="text-accent" /> {t.worksheet.modal_title}</h2>
              <button onClick={() => setIsUpdateModalOpen(false)} className="text-muted-foreground hover:text-foreground p-1 transition-colors"><X size={24}/></button>
            </div>
            <div className="flex flex-col gap-4 text-left">
              {selectedRecord?.accountCode === "411121" && (
                <div className="rounded-2xl border border-accent/10 bg-accent/5 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-accent">Data Pendukung PPh 21</h3>
                      <p className="text-xs text-muted-foreground mt-1">Cek detail penerima sebelum menandai selesai.</p>
                    </div>
                  </div>
                  {isPph21DetailLoading ? (
                    <div className="text-xs text-muted-foreground">Memuat detail PPh 21...</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-background/80 rounded-xl p-3">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">SP2D</div>
                          <div className="font-black mt-1">{selectedPph21Record?.sp2dNumber || selectedRecord.sp2dNumber || "-"}</div>
                        </div>
                        <div className="bg-background/80 rounded-xl p-3">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Tanggal SP2D</div>
                          <div className="font-black mt-1">
                            {(selectedPph21Record?.sp2dDate || selectedRecord.sp2dDate)
                              ? new Date(selectedPph21Record?.sp2dDate || selectedRecord.sp2dDate || "").toLocaleDateString(language === "ID" ? "id-ID" : "en-US")
                              : "-"}
                          </div>
                        </div>
                        <div className="bg-background/80 rounded-xl p-3">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Uraian</div>
                          <div className="font-black mt-1 line-clamp-2">{selectedPph21Record?.description || selectedRecord.description || "-"}</div>
                        </div>
                        <div className="bg-background/80 rounded-xl p-3">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Nilai SPM</div>
                          <div className="font-black mt-1">IDR {selectedRecord.totalValue?.toLocaleString("id-ID") || "0"}</div>
                        </div>
                        <div className="bg-background/80 rounded-xl p-3">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Potongan</div>
                          <div className="font-black mt-1">IDR {selectedRecord.deductionAmount.toLocaleString("id-ID")}</div>
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-background/70">
                        {selectedPph21Record?.pph21Batch?.withholdings?.length ? (
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-background/90">
                              <tr className="text-left">
                                <th className="p-3">Nama</th>
                                <th className="p-3">NIK</th>
                                <th className="p-3">Gross</th>
                                <th className="p-3">Pajak</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPph21Record.pph21Batch.withholdings.map((item) => (
                                <tr key={item.id} className="border-t border-border/60">
                                  <td className="p-3 font-bold">{item.recipientName}</td>
                                  <td className="p-3 font-mono text-[11px] text-muted-foreground">{item.recipient?.nik || "-"}</td>
                                  <td className="p-3">IDR {item.gross.toLocaleString("id-ID")}</td>
                                  <td className="p-3">IDR {item.calculatedTax.toLocaleString("id-ID")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-4 text-xs text-muted-foreground">Belum ada rincian PPh 21 untuk record ini. Silakan isi langsung di editor di bawah.</div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsPph21EditorOpen((current) => !current)}
                          className="text-[10px] font-black uppercase text-accent hover:underline"
                        >
                          {isPph21EditorOpen ? "Tutup editor" : "Edit rincian di sini"}
                        </button>
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={downloadPph21XmlFromRecords}
                            disabled={!isPph21XmlReady || isPph21XmlDownloading || isPph21Saving || isPph21DetailLoading}
                            className="inline-flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-bold text-accent disabled:cursor-not-allowed disabled:opacity-50"
                            title={isPph21XmlReady ? "Unduh XML PPh 21" : "Lengkapi rincian dulu sebelum mengunduh XML"}
                          >
                            {isPph21XmlDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            Download XML
                          </button>
                          {!isPph21XmlReady && (
                            <span className="text-[10px] text-muted-foreground text-right">
                              Simpan rincian dulu agar XML bisa diunduh.
                            </span>
                          )}
                        </div>
                      </div>
                      {isPph21EditorOpen && (
                        <div className="rounded-2xl border border-border bg-background/70 p-4 flex flex-col gap-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Editor PPh 21</div>
                              <div className="text-xs text-muted-foreground mt-1">Perubahan di sini akan menyimpan rincian langsung ke batch PPh 21 record ini.</div>
                            </div>
                            <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${pph21TaxTotal === selectedRecord.deductionAmount ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                              Total Rp {pph21TaxTotal.toLocaleString("id-ID")} / Rp {selectedRecord.deductionAmount.toLocaleString("id-ID")}
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Withholding Date</label>
                              <input
                                type="date"
                                value={pph21WithholdingDate}
                                onChange={(e) => setPph21WithholdingDate(e.target.value)}
                                className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => setPph21Lines((current) => [...current, createPph21Line()])}
                                className="inline-flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-bold text-accent"
                              >
                                <Plus size={14} /> Tambah recipient
                              </button>
                            </div>
                          </div>
                          <datalist id="records-pph21-nik-recipients">
                            {pph21Recipients.map((recipient) => (
                              <option key={recipient.id} value={recipient.nik}>{recipient.name}</option>
                            ))}
                          </datalist>
                          <datalist id="records-pph21-name-recipients">
                            {pph21Recipients.map((recipient) => (
                              <option key={`${recipient.id}-name`} value={recipient.name}>{recipient.nik}</option>
                            ))}
                          </datalist>
                          <div className="grid gap-3">
                            {pph21Lines.map((line, index) => {
                              const rule = PPH21_TAX_OBJECTS[line.taxObjectCode];
                              const calculatedTax = Math.round((Number(line.gross) || 0) * rule.deemed / 100 * rule.rate / 100);
                              return (
                                <div
                                  key={line.clientId}
                                  ref={(node) => {
                                    pph21RowRefs.current[index] = node;
                                  }}
                                  className={`grid grid-cols-1 gap-3 rounded-2xl border p-3 md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.55fr)_minmax(0,1fr)_auto] md:items-end md:gap-2 ${
                                    pph21ErrorRow === index + 1
                                      ? "border-rose-500/40 bg-rose-500/5 ring-1 ring-rose-500/20"
                                      : "border-border bg-background/50"
                                  }`}
                                >
                                  <div className="min-w-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    <span className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-muted px-3 text-[11px] font-black tabular-nums text-foreground/80">
                                      {index + 1}
                                    </span>
                                  </div>
                                  <label className="min-w-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    NIK
                                    <input
                                      list="records-pph21-nik-recipients"
                                      value={line.nik}
                                      onChange={(e) => choosePph21Recipient(index, e.target.value.replace(/\s+/g, ""), "nik")}
                                      className="mt-1 w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
                                    />
                                  </label>
                                  <label className="min-w-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Nama
                                    <input
                                      list="records-pph21-name-recipients"
                                      value={line.name}
                                      onChange={(e) => choosePph21Recipient(index, e.target.value, "name")}
                                      className="mt-1 w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
                                    />
                                  </label>
                                  <label className="min-w-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Tax Object
                                    <select
                                      value={line.taxObjectCode}
                                      onChange={(e) => setPph21Lines((current) => current.map((item, i) => i === index ? { ...item, taxObjectCode: e.target.value as Pph21TaxCode } : item))}
                                      title={PPH21_TAX_OBJECT_LABELS[line.taxObjectCode]}
                                      className="mt-1 w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none min-w-0"
                                    >
                                      {Object.keys(PPH21_TAX_OBJECTS).map((code) => (
                                        <option key={code} value={code}>{code} — {PPH21_TAX_OBJECT_LABELS[code as Pph21TaxCode]}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="min-w-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Gross
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={formatGrossInput(line.gross)}
                                      onChange={(e) => setPph21Lines((current) => current.map((item, i) => i === index ? { ...item, gross: e.target.value.replace(/\D/g, "") } : item))}
                                      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                      placeholder="1.000.000"
                                      className="mt-1 w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => setPph21Lines((current) => current.length > 1 ? current.filter((_, i) => i !== index) : [createPph21Line()])}
                                    className="inline-flex items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-600"
                                    title="Hapus recipient"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                  <div className="md:col-span-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Pajak terhitung: Rp {calculatedTax.toLocaleString("id-ID")}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            <div className="text-xs text-muted-foreground">
                              Total pajak harus sama dengan potongan SP2D sebelum selesai.
                            </div>
                            <button
                              type="button"
                              onClick={savePph21FromRecords}
                              disabled={isPph21Saving}
                              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                            >
                              {isPph21Saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                              Simpan rincian
                            </button>
                          </div>
                          {pph21SaveError && (
                            <div
                              role="alert"
                              className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600"
                            >
                              {pph21SaveError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Status Penugasan</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setUpdateForm({...updateForm, status: "COMPLETED"})}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${updateForm.status === "COMPLETED" ? "bg-emerald-500/10 border-emerald-500 text-emerald-600" : "bg-muted border-transparent text-muted-foreground"}`}
                  >
                    {t.worksheet.completed}
                  </button>
                  <button 
                    onClick={() => setUpdateForm({...updateForm, status: "ISSUES"})}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${updateForm.status === "ISSUES" ? "bg-amber-500/10 border-amber-500 text-amber-600" : "bg-muted border-transparent text-muted-foreground"}`}
                  >
                    {t.worksheet.issues}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{t.worksheet.doc_link}</label><input className="w-full bg-muted border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all" value={updateForm.docLink} onChange={e => setUpdateForm({...updateForm, docLink: e.target.value})} /></div>
              <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{t.worksheet.notes}</label><textarea className="w-full bg-muted border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all min-h-[100px]" value={updateForm.notes} placeholder={updateForm.status === "ISSUES" ? "Jelaskan kendala yang dihadapi..." : ""} onChange={e => setUpdateForm({...updateForm, notes: e.target.value})} /></div>
            </div>
            <button onClick={submitUpdate} className={`premium-button font-bold text-sm py-4 flex items-center justify-center gap-2 ${updateForm.status === "ISSUES" ? "bg-amber-600" : ""}`}><Check size={18} /> {t.worksheet.save}</button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-1000">
          <div className="glass-card bg-white/95! dark:bg-card/70! p-8 rounded-3xl w-full max-w-4xl flex flex-col gap-8 shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center bg-muted/10 p-2 rounded-2xl">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-accent/10 rounded-2xl text-accent"><Hash size={24} /></div>
                 <div className="text-left"><h2 className="text-2xl font-bold tracking-tight">{selectedRecord.spmNumber}</h2><p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">{t.worksheet.spm_detail}</p></div>
               </div>
               <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-all"><X size={24} /></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
               <div className="flex flex-col gap-6">
                 <div><label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t.worksheet.account_code}</label><div className="flex items-center gap-3"><span className="badge bg-accent/10 text-accent border border-accent/20 text-sm py-1.5 px-4">{selectedRecord.accountCode}</span><span className="text-xs font-bold opacity-70">{getTaxAccountLabel(selectedRecord.accountCode)}</span></div></div>
                 <div><label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t.worksheet.recipient_amount}</label><div className="p-4 bg-muted/60 rounded-2xl border border-border"><p className="font-bold text-lg mb-1">{selectedRecord.recipient}</p><div className="flex flex-col gap-1"><div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">{language === "ID" ? "Nilai SPM" : "SPM Amount"}</span><span className="font-mono font-bold text-foreground/70">IDR {selectedRecord.totalValue?.toLocaleString("id-ID") || "0"}</span></div><div className="flex justify-between items-center text-base"><span className="font-medium">{language === "ID" ? "Potongan Pajak" : "Tax Deduction"}</span><span className="font-mono font-bold text-accent">IDR {selectedRecord.deductionAmount.toLocaleString("id-ID")}</span></div></div></div></div>
                 <div><label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t.worksheet.spm_description}</label><p className="text-sm leading-relaxed italic text-muted-foreground bg-accent/5 p-4 rounded-2xl border border-accent/10">“{selectedRecord.description || "-"}”</p></div>
               </div>
               <div className="flex flex-col gap-6">
                 <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl"><Landmark className="text-muted-foreground" size={20} /><div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">SP2D REF</span><span className="text-sm font-bold">{selectedRecord.sp2dNumber || "-"}</span></div></div>
                    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl"><Calendar className="text-muted-foreground" size={20} /><div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">{t.worksheet.deadline}</span><span className={`text-sm font-bold ${getDeadlineStatus(selectedRecord).status === "ok" ? "text-emerald-500" : "text-rose-500"}`}>{getDeadlineStatus(selectedRecord).label}</span></div></div>
                    {selectedRecord.status === "COMPLETED" && selectedRecord.completionDate && (
                      <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in slide-in-from-right-4">
                        <CheckCircle2 className="text-emerald-500" size={20} />
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-emerald-500">{language === "ID" ? "Waktu Penyelesaian" : "Completion Time"}</span>
                          <span className="text-sm font-bold">{new Date(selectedRecord.completionDate).toLocaleString(language === "ID" ? "id-ID" : "en-US", { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    )}
                 </div>
                 <div className="flex flex-col gap-4 border-t border-border pt-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.worksheet.status}</span>
                      <div className={`badge ${selectedRecord.status === "COMPLETED" ? "badge-completed" : selectedRecord.status === "ISSUES" ? "bg-amber-500/10! text-amber-500! border-amber-500/20!" : "badge-pending"}`}>
                        {selectedRecord.status === "COMPLETED" ? t.worksheet.completed : selectedRecord.status === "ISSUES" ? t.worksheet.issues : t.worksheet.pending}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.worksheet.assignee}</span>
                      <span className="text-sm font-medium">{colleagues.find(c => c.id === selectedRecord.assigneeId)?.name || t.worksheet.unassigned}</span>
                    </div>
                  </div>
                 {selectedRecord.notes && (<div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10"><label className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2"><FileText size={14} /> {t.worksheet.notes}</label><p className="text-xs italic text-muted-foreground leading-relaxed">{selectedRecord.notes}</p></div>)}
                 {selectedRecord.docLink && (<a href={selectedRecord.docLink} target="_blank" rel="noopener noreferrer" className="premium-button text-xs py-3 flex items-center justify-center gap-2 bg-emerald-600"><ExternalLink size={14} /> {language === "ID" ? "Buka Link Bukti Potong" : "Open Tax Receipt Link"}</a>)}
               </div>
             </div>
             {selectedRecord.accountCode === "411121" && (
               <div className="rounded-2xl border border-accent/10 bg-accent/5 p-5 flex flex-col gap-4">
                 <div className="flex flex-wrap items-center justify-between gap-3">
                   <div>
                     <h3 className="text-sm font-black uppercase tracking-widest text-accent">Data Pendukung PPh 21</h3>
                     <p className="text-xs text-muted-foreground mt-1">Recipient yang sudah tersimpan di batch PPh 21 record ini.</p>
                   </div>
                   <button
                     type="button"
                     onClick={downloadPph21XmlFromRecords}
                     disabled={
                       isPph21DetailLoading ||
                       isPph21Saving ||
                       isPph21XmlDownloading ||
                       !selectedPph21Record?.pph21Batch?.withholdings?.length ||
                       !isPph21XmlReady
                     }
                     className="inline-flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-bold text-accent disabled:cursor-not-allowed disabled:opacity-50"
                     title={isPph21XmlReady ? "Unduh XML PPh 21" : "Lengkapi rincian dulu sebelum mengunduh XML"}
                   >
                     {isPph21XmlDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                     Download XML
                   </button>
                 </div>
                 {isPph21DetailLoading ? (
                   <div className="text-xs text-muted-foreground">Memuat detail PPh 21...</div>
                 ) : selectedPph21Record?.pph21Batch?.withholdings?.length ? (
                   <div className="grid gap-3">
                     <div className="grid grid-cols-2 gap-3 text-xs">
                       <div className="bg-background/80 rounded-xl p-3">
                         <div className="text-[10px] uppercase font-bold text-muted-foreground">Withholding Date</div>
                         <div className="font-black mt-1">
                           {selectedPph21Record.pph21Batch.withholdingDate
                             ? new Date(selectedPph21Record.pph21Batch.withholdingDate).toLocaleDateString("id-ID")
                             : "-"}
                         </div>
                       </div>
                       <div className="bg-background/80 rounded-xl p-3">
                         <div className="text-[10px] uppercase font-bold text-muted-foreground">Recipient</div>
                         <div className="font-black mt-1">{selectedPph21Record.pph21Batch.withholdings.length} orang</div>
                       </div>
                     </div>
                     <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background/70">
                       <table className="w-full text-xs">
                         <thead className="sticky top-0 bg-background/90">
                           <tr className="text-left">
                             <th className="p-3">Nama</th>
                             <th className="p-3">NIK</th>
                             <th className="p-3">Tax Object</th>
                             <th className="p-3">Gross</th>
                             <th className="p-3">Pajak</th>
                           </tr>
                         </thead>
                         <tbody>
                           {selectedPph21Record.pph21Batch.withholdings.map((item) => (
                             <tr key={item.id} className="border-t border-border/60">
                               <td className="p-3 font-bold">{item.recipientName}</td>
                               <td className="p-3 font-mono text-[11px] text-muted-foreground">{item.recipient?.nik || "-"}</td>
                               <td className="p-3">{item.taxObjectCode}</td>
                               <td className="p-3">IDR {item.gross.toLocaleString("id-ID")}</td>
                               <td className="p-3">IDR {item.calculatedTax.toLocaleString("id-ID")}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                   </div>
                 ) : (
                   <div className="text-sm text-muted-foreground">Belum ada recipient PPh 21 di record ini.</div>
                 )}
               </div>
             )}
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-200 animate-in slide-in-from-bottom-8 duration-300 w-[92%] md:w-auto">
           <div className="bg-slate-900 shadow-2xl px-6 md:px-12 py-3 md:py-4 rounded-3xl md:rounded-full border border-white/10 flex flex-col md:flex-row items-center gap-4 md:gap-8 min-w-[280px]">
              <div className="flex items-center gap-4 md:gap-10">
                <div className="flex flex-col items-center">
                  <span className="text-lg md:text-[20px] font-black text-white tabular-nums leading-none mb-1">{selectedIds.size}</span>
                  <span className="text-[8px] md:text-[10px] uppercase font-bold tracking-widest text-white/50">{language === "ID" ? "TERPILIH" : "SELECTED"}</span>
                </div>
                <div className="h-6 md:h-8 w-px bg-white/10" />
                <div className="flex items-center gap-3">
                   <span className="text-[10px] md:text-xs font-bold text-white/40 uppercase tracking-widest hidden sm:inline">{language === "ID" ? "Tugaskan ke" : "Assign to"}</span>
                   <div className="relative">
                      <select 
                        className="bg-white/5 hover:bg-white/10 text-white text-[11px] md:text-xs font-bold py-2 md:py-2.5 px-8 md:px-10 rounded-full border border-white/10 outline-none cursor-pointer appearance-none transition-all"
                        value=""
                        onChange={(e) => handleBulkAssign(e.target.value ? Number(e.target.value) : 0)}
                      >
                        <option value="" disabled className="text-slate-900">{language === "ID" ? "--- Pilih Rekan ---" : "--- Select Colleague ---"}</option>
                        <option value="0" className="text-slate-900">{t.worksheet.unassigned}</option>
                        {colleagues.map((col: Colleague) => (<option key={col.id} value={col.id} className="text-slate-900">{col.name}</option>))}
                      </select>
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                   </div>
                </div>
                <button
                  type="button"
                  onClick={exportSelectedPph21Xml}
                  disabled={selectedPph21Ids.length === 0 || isPph21XmlExporting || isLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5 text-[11px] md:text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40"
                  title={selectedPph21Ids.length > 0 ? "Export XML PPh 21 untuk record terpilih" : "Pilih minimal satu SP2D PPh 21"}
                >
                  {isPph21XmlExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Export XML {selectedPph21Ids.length > 0 ? `(${selectedPph21Ids.length})` : ""}
                </button>
              </div>
              <button onClick={() => setSelectedIds(new Set())} className="text-white/40 hover:text-rose-400 p-2 transition-colors"><X size={20} /></button>
           </div>
        </div>
      )}

      <header className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex flex-col gap-2 text-left">
            <h1 className="text-3xl font-bold tracking-tight">{t.worksheet.title}</h1>
            <p className="text-muted-foreground">{t.worksheet.subtitle}</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="relative">
               <button
                 type="button"
                 onClick={() => setShowImportOptions((current) => !current)}
                 className={`glass-card px-5 py-2.5 flex items-center gap-3 text-sm font-bold transition-all shadow-lg border-accent/20 group active:scale-95 ${showImportOptions ? "bg-accent text-white" : "hover:bg-white/10 text-accent"}`}
               >
                  <Upload size={18} className="group-hover:translate-y-0.5 transition-transform" />
                  Import
                  <ChevronDown size={14} className={`transition-transform ${showImportOptions ? "rotate-180" : ""}`} />
               </button>
               {showImportOptions && (
                 <div className="absolute right-0 top-full mt-2 w-72 glass-card p-2 z-100 shadow-2xl animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 border-white/5">
                   <button
                     type="button"
                     onClick={() => {
                       setShowImportOptions(false);
                       void openMonitoringImport();
                     }}
                     disabled={isMonitoringImporting}
                     className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-violet-500/10 transition-colors text-left group disabled:opacity-60"
                   >
                     <div className="p-1.5 bg-violet-500/10 text-violet-500 rounded-lg group-hover:scale-110 transition-transform"><Upload size={16} /></div>
                     <div className="min-w-0">
                       <div className="text-xs font-bold">Import Monitoring SP2D Bank</div>
                       <div className="text-[10px] text-muted-foreground">Preview transaksi non-final dari SPANExt</div>
                     </div>
                   </button>
                   <button
                     type="button"
                     onClick={() => {
                       setShowImportOptions(false);
                       void openPayrollImport();
                     }}
                     disabled={isPayrollXmlImporting}
                     className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-cyan-500/10 transition-colors text-left group disabled:opacity-60"
                   >
                     <div className="p-1.5 bg-cyan-500/10 text-cyan-500 rounded-lg group-hover:scale-110 transition-transform"><Upload size={16} /></div>
                     <div className="min-w-0">
                       <div className="text-xs font-bold">Import XML Non-Final</div>
                       <div className="text-[10px] text-muted-foreground">Upload XML untuk cek/matching non-final</div>
                     </div>
                   </button>
                   <button
                     type="button"
                     onClick={() => {
                       setShowImportOptions(false);
                       pph21ImportInputRef.current?.click();
                     }}
                     disabled={isImportingXml}
                     className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-emerald-500/10 transition-colors text-left group disabled:opacity-60"
                   >
                     <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg group-hover:scale-110 transition-transform">
                       {isImportingXml ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                     </div>
                     <div className="min-w-0">
                       <div className="text-xs font-bold">{isImportingXml ? "Importing..." : "Import XML PPh21 Final"}</div>
                       <div className="text-[10px] text-muted-foreground">Flow final tetap dipisah</div>
                     </div>
                   </button>
                 </div>
               )}
             </div>
             <input
               ref={pph21ImportInputRef}
               type="file"
               accept=".xml,application/xml,text/xml"
               className="hidden"
               disabled={isImportingXml}
               onChange={(event) => {
                 const file = event.target.files?.[0];
                 if (file) void checkImportedXml(file);
                 event.target.value = "";
               }}
             />
             <button 
               onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
               className={`glass-card px-5 py-2.5 flex items-center gap-3 text-sm font-bold transition-all shadow-lg border-accent/20 group active:scale-95 ${showAdvancedFilters ? "bg-accent text-white" : "hover:bg-white/10 text-accent"}`}
             >
                <CalendarRange size={18} />
                {language === "ID" ? "Filter Lanjutan" : "Advanced Filters"}
             </button>

             <div className="relative">
               <button 
                 onClick={() => setShowExportOptions(!showExportOptions)}
                 className="glass-card px-5 py-2.5 flex items-center gap-3 text-sm font-bold hover:bg-white/10 transition-all shadow-lg border-emerald-500/20 text-emerald-500 group active:scale-95"
               >
                  <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                  {language === "ID" ? "Ekspor" : "Export"}
                  <ChevronDown size={14} className={`transition-transform ${showExportOptions ? "rotate-180" : ""}`} />
               </button>
               {showExportOptions && (
                 <div className="absolute right-0 top-full mt-2 w-48 glass-card p-2 z-100 shadow-2xl animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 border-white/5">
                    <button onClick={() => { exportToExcel(); setShowExportOptions(false); }} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-emerald-500/10 transition-colors text-left group">
                      <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg group-hover:scale-110 transition-transform"><Table size={16} /></div>
                      <span className="text-xs font-bold">Excel (.xlsx)</span>
                    </button>
                    <button onClick={() => { exportToCSV(); setShowExportOptions(false); }} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-blue-500/10 transition-colors text-left group">
                      <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg group-hover:scale-110 transition-transform"><FileType size={16} /></div>
                      <span className="text-xs font-bold">CSV File (.csv)</span>
                    </button>
                    <button onClick={() => { exportToPDF(); setShowExportOptions(false); }} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-rose-500/10 transition-colors text-left group">
                      <div className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg group-hover:scale-110 transition-transform"><FileJson size={16} /></div>
                      <span className="text-xs font-bold">PDF Document (.pdf)</span>
                    </button>
                 </div>
               )}
             </div>
          </div>
        </div>

        {importError && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600">
            {importError}
          </div>
        )}

        {monitoringImportSummary && (
          <section className="glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-lg">Hasil import Monitoring SP2D Bank</h2>
                <p className="text-sm text-muted-foreground">
                  {monitoringImportSummary.fileName} · {monitoringImportSummary.totalRows} baris terbaca · {monitoringImportSummary.eligibleRows} eligible non-final
                </p>
              </div>
              <button type="button" onClick={() => setMonitoringImportSummary(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <div className="rounded-xl bg-violet-500/10 text-violet-600 p-3">
                <div className="text-xs font-bold uppercase">Baris</div>
                <div className="text-2xl font-black">{monitoringImportSummary.totalRows}</div>
              </div>
              <div className="rounded-xl bg-emerald-500/10 text-emerald-600 p-3">
                <div className="text-xs font-bold uppercase">Eligible</div>
                <div className="text-2xl font-black">{monitoringImportSummary.eligibleRows}</div>
              </div>
              <div className="rounded-xl bg-amber-500/10 text-amber-600 p-3">
                <div className="text-xs font-bold uppercase">Excluded</div>
                <div className="text-2xl font-black">{monitoringImportSummary.excludedRows}</div>
              </div>
              <div className="rounded-xl bg-cyan-500/10 text-cyan-600 p-3">
                <div className="text-xs font-bold uppercase">Total eligible</div>
                <div className="text-2xl font-black">Rp{new Intl.NumberFormat("id-ID").format(monitoringImportSummary.totalEligibleAmount)}</div>
              </div>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="premium-table min-w-[1200px]">
                <thead>
                  <tr>
                    <th>Baris</th>
                    <th>No SP2D</th>
                    <th>Tgl SP2D</th>
                    <th>Jenis SPM</th>
                    <th>Nama Penerima</th>
                    <th>Match Master</th>
                    <th>Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoringImportSummary.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.noSp2d}`}>
                      <td>{row.rowNumber}</td>
                      <td className="font-bold">{row.noSp2d || "-"}</td>
                      <td>{row.tanggalSp2d || "-"}</td>
                      <td>{row.jenisSpm || "-"}</td>
                      <td className="max-w-[240px] truncate">{row.namaPenerima || "-"}</td>
                      <td>{row.matchedRecipientName || "-"}</td>
                      <td>Rp{new Intl.NumberFormat("id-ID").format(row.jumlah)}</td>
                      <td>
                        <span className={`badge ${row.isEligible ? "badge-completed" : "bg-rose-500/10! text-rose-600!"}`}>
                          {row.isEligible ? "ELIGIBLE" : `EXCLUDED${row.excludeReason ? ` · ${row.excludeReason}` : ""}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {importReport && (
          <section className="glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-lg">Hasil import dan pengecekan XML</h2>
                <p className="text-sm text-muted-foreground">
                  {importReport.fileName} · {importReport.totalRows} recipient dalam {importReport.totalDocuments} SP2D
                </p>
              </div>
              <button type="button" onClick={() => setImportReport(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl bg-emerald-500/10 text-emerald-600 p-3">
                <div className="text-xs font-bold uppercase">Berhasil diisi</div>
                <div className="text-2xl font-black">{importReport.importedCount}</div>
              </div>
              <div className="rounded-xl bg-amber-500/10 text-amber-600 p-3">
                <div className="text-xs font-bold uppercase">Selisih</div>
                <div className="text-2xl font-black">{importReport.mismatchCount}</div>
              </div>
              <div className="rounded-xl bg-rose-500/10 text-rose-600 p-3">
                <div className="text-xs font-bold uppercase">Tidak ditemukan</div>
                <div className="text-2xl font-black">{importReport.notFoundCount}</div>
              </div>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="premium-table min-w-[850px]">
                <thead>
                  <tr>
                    <th>Document / SP2D</th>
                    <th>Recipient</th>
                    <th>Gross XML</th>
                    <th>Pajak XML</th>
                    <th>Potongan SP2D</th>
                    <th>Selisih</th>
                    <th>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {importReport.groups.map((group) => (
                    <tr key={group.documentNumber}>
                      <td>
                        <div className="font-bold">{group.documentNumber}</div>
                        <div className="text-xs text-muted-foreground">{group.spmNumber || "SP2D tidak ditemukan"}</div>
                      </td>
                      <td>{group.recipientCount}</td>
                      <td>Rp{new Intl.NumberFormat("id-ID").format(group.xmlGross)}</td>
                      <td>Rp{new Intl.NumberFormat("id-ID").format(group.xmlTax)}</td>
                      <td>{group.sp2dDeduction === null ? "—" : `Rp${new Intl.NumberFormat("id-ID").format(group.sp2dDeduction)}`}</td>
                      <td>{group.difference === null ? "—" : `Rp${new Intl.NumberFormat("id-ID").format(group.difference)}`}</td>
                      <td>
                        <span className={`badge ${group.status === "IMPORTED" || group.status === "ALREADY_FILLED" ? "badge-completed" : "bg-amber-500/10! text-amber-600!"}`}>
                          {group.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {isPayrollImportOpen && (
          <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Import XML Non-Final</h2>
                  <p className="text-sm text-muted-foreground mt-1">Upload file XML Non-Final, pilih manual nomor SPM/SP2D yang terkait, lalu bandingkan total pajaknya.</p>
                </div>
                <button type="button" onClick={closePayrollImport} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
                <div className="rounded-2xl border border-border bg-muted/20 p-4 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => payrollImportInputRef.current?.click()}
                      disabled={isPayrollXmlImporting}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-600 disabled:opacity-60"
                    >
                      {isPayrollXmlImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {isPayrollXmlImporting ? "Memeriksa..." : "Pilih XML Non-Final"}
                    </button>
                    <input
                      ref={payrollImportInputRef}
                      type="file"
                      accept=".xml,application/xml,text/xml"
                      className="hidden"
                      disabled={isPayrollXmlImporting}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void checkPayrollXml(file);
                        event.target.value = "";
                      }}
                    />
                    {payrollImportSummary && (
                      <button
                        type="button"
                        onClick={() => setPayrollImportSummary(null)}
                        className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
                      >
                        Reset file
                      </button>
                    )}
                  </div>

                  {payrollImportError && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600">
                      {payrollImportError}
                    </div>
                  )}

                  {payrollImportSummary ? (
                    <>
                      <div
                        className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                          payrollAutoMatchedRecord
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {payrollAutoMatchedRecord
                          ? `Record otomatis cocok ditemukan: ${payrollAutoMatchedRecord.spmNumber} · ${payrollAutoMatchedRecord.sp2dNumber || "SP2D belum terbit"}`
                          : "Tidak ada record yang cocok otomatis. Silakan pilih SPM/SP2D secara manual."}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">File</div>
                          <div className="font-black mt-1 break-all leading-tight">{payrollImportSummary.fileName}</div>
                        </div>
                        <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Rows</div>
                          <div className="font-black mt-1">{payrollImportSummary.totalRows}</div>
                        </div>
                        <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Gross XML</div>
                          <div className="font-black mt-1 break-all leading-tight text-[clamp(1rem,1.2vw,1.35rem)]">Rp{new Intl.NumberFormat("id-ID").format(payrollImportSummary.totalGross)}</div>
                        </div>
                        <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Pajak XML</div>
                          <div className="font-black mt-1 break-all leading-tight text-[clamp(1rem,1.2vw,1.35rem)]">Rp{new Intl.NumberFormat("id-ID").format(payrollImportSummary.totalTax)}</div>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Periode</div>
                          <div className="font-black mt-1 break-all leading-tight">
                            {payrollImportSummary.taxPeriodMonth && payrollImportSummary.taxPeriodYear
                              ? `${String(payrollImportSummary.taxPeriodMonth).padStart(2, "0")}/${payrollImportSummary.taxPeriodYear}`
                              : "-"}
                          </div>
                        </div>
                        <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Withholding Date</div>
                          <div className="font-black mt-1 break-all leading-tight">
                            {payrollImportSummary.withholdingDate ? new Date(payrollImportSummary.withholdingDate).toLocaleDateString("id-ID") : "-"}
                          </div>
                        </div>
                        <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border md:col-span-2">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Recipient unik</div>
                          <div className="font-black mt-1">{payrollImportSummary.uniqueRecipients}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-background/50 p-6 text-sm text-muted-foreground">
                      Upload file XML Non-Final dulu untuk membaca ringkasannya.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4 flex flex-col gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pilih record manual</div>
                    <div className="text-sm text-muted-foreground mt-1">Cari semua record yang belum completed. Bisa pakai SPM/SP2D, recipient, gross, atau potongan untuk cari record yang paling sesuai.</div>
                  </div>
                  <input
                    type="text"
                    value={payrollRecordQuery}
                    onChange={(e) => setPayrollRecordQuery(e.target.value)}
                    placeholder="Cari SPM / SP2D / recipient / gross / potongan"
                    className="w-full rounded-xl bg-background px-4 py-3 text-sm outline-none border border-border focus:ring-2 focus:ring-cyan-500/20"
                  />
                  <div className="max-h-[26rem] overflow-y-auto rounded-2xl border border-border bg-background">
                    {filteredPayrollImportRecords.length ? (
                      <div className="divide-y divide-border overflow-hidden">
                        {filteredPayrollImportRecords.map((record) => {
                          const selected = record.id === selectedPayrollRecordId;
                          return (
                            <button
                              key={record.id}
                              type="button"
                              onClick={() => setSelectedPayrollRecordId(record.id)}
                              className={`w-full text-left p-4 transition-colors overflow-hidden ${selected ? "bg-cyan-500/10" : "hover:bg-muted/60"}`}
                            >
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0">
                                  <div className="font-black break-words leading-tight">{record.spmNumber}</div>
                                  <div className="text-xs text-muted-foreground mt-1 break-words leading-relaxed">
                                    {record.sp2dNumber || "SP2D belum terbit"} · {record.recipient || "-"}
                                  </div>
                                  <div className="mt-2">
                                    <span className={`badge ${record.status === "ISSUES" ? "bg-amber-500/10! text-amber-500! border-amber-500/20!" : "badge-pending"}`}>
                                      {record.status}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 max-w-[42%]">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Potongan</div>
                                  <div className="font-black break-words">Rp{new Intl.NumberFormat("id-ID").format(record.deductionAmount)}</div>
                                </div>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-2 break-words">
                                {record.sp2dDate ? new Date(record.sp2dDate).toLocaleDateString("id-ID") : "-"} · {getTaxAccountLabel(record.accountCode)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">Tidak ada record yang cocok.</div>
                    )}
                  </div>

                  {selectedPayrollRecord && payrollImportSummary && payrollImportComparison && (
                    <div className={`rounded-2xl border p-4 overflow-hidden ${payrollImportComparison.isMatch ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-amber-500/20 bg-amber-500/10 text-amber-700"}`}>
                      <div className="flex items-start justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black uppercase tracking-widest">Hasil pencocokan</div>
                          <div className="font-black mt-1 break-words leading-tight">{selectedPayrollRecord.spmNumber} · {selectedPayrollRecord.sp2dNumber || "SP2D belum terbit"}</div>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-background/60 shrink-0">
                          {payrollImportComparison.isMatch ? "Sesuai" : "Tidak sesuai"}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
                        <div className="rounded-xl bg-background/70 p-3 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Total pajak XML</div>
                          <div className="font-black mt-1">Rp{new Intl.NumberFormat("id-ID").format(payrollImportSummary.totalTax)}</div>
                        </div>
                        <div className="rounded-xl bg-background/70 p-3 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Potongan record</div>
                          <div className="font-black mt-1">Rp{new Intl.NumberFormat("id-ID").format(selectedPayrollRecord.deductionAmount)}</div>
                        </div>
                        <div className="rounded-xl bg-background/70 p-3 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Selisih</div>
                          <div className="font-black mt-1">Rp{new Intl.NumberFormat("id-ID").format(payrollImportComparison.difference)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search & Basic Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input type="text" placeholder={t.worksheet.search_placeholder} className="w-full bg-muted border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
          <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}><option value="all">{t.worksheet.all_accounts}</option>{uniqueAccounts.map(acc => (<option key={acc} value={acc}>{acc} ({getTaxAccountLabel(acc)})</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}><option value="all">{t.nav.daftar_rekan} ({t.worksheet.show_all})</option><option value="unassigned">{t.worksheet.unassigned}</option>{colleagues.map((col: Colleague) => (<option key={col.id} value={col.id}>{col.name}</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          <div className="relative"><CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">{t.worksheet.all_status}</option><option value="PENDING">{t.worksheet.pending}</option><option value="COMPLETED">{t.worksheet.completed}</option><option value="ISSUES">{t.worksheet.issues}</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          <div className="relative"><FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[160px]" value={pph21ProcessFilter} onChange={(e) => setPph21ProcessFilter(e.target.value as typeof pph21ProcessFilter)}><option value="all">Semua PPh 21 Process</option><option value="PENDING">{getPph21ProcessLabel("PENDING")}</option><option value="DATA_ENTERED">{getPph21ProcessLabel("DATA_ENTERED")}</option><option value="COMPLETED">{getPph21ProcessLabel("COMPLETED")}</option><option value="ISSUES">{getPph21ProcessLabel("ISSUES")}</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          
          {(searchQuery || accountFilter !== "all" || assigneeFilter !== "all" || statusFilter !== "all" || pph21ProcessFilter !== "all" || startDate || endDate) && (
            <button onClick={resetFilters} className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 transition-all" title="Reset semua filter">
              <RefreshCw size={18} />
            </button>
          )}
        </div>

        {/* Advanced Search Panel (Date Range) */}
        {showAdvancedFilters && (
          <div className="glass-card p-6 border-accent/20 animate-in slide-in-from-top-4 duration-300">
             <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex flex-col gap-2 flex-1 text-left">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rentang Tanggal SP2D (Mulai)</label>
                   <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                      <input type="date" className="w-full bg-muted/50 border-none py-3 pl-12 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 transition-all font-bold text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                   </div>
                </div>
                <div className="flex flex-col gap-2 flex-1 text-left">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rentang Tanggal SP2D (Selesai)</label>
                   <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                      <input type="date" className="w-full bg-muted/50 border-none py-3 pl-12 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 transition-all font-bold text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                   </div>
                </div>
                <div className="h-full flex items-end">
                   <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10 flex items-center gap-3">
                      <AlertCircle className="text-accent" size={18} />
                      <span className="text-[10px] uppercase font-black tracking-tighter opacity-70">Filtering by SP2D Issuance Date</span>
                   </div>
                </div>
             </div>
          </div>
        )}
      </header>

      {isMonitoringImportOpen && (
        <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Import Monitoring SP2D Bank</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload workbook monitoring SP2D dari SPANExt untuk memeriksa transaksi non-final dan mencocokkannya ke master penerima PTKP.
                </p>
              </div>
              <button type="button" onClick={closeMonitoringImport} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <div className="rounded-2xl border border-border bg-muted/20 p-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => monitoringImportInputRef.current?.click()}
                    disabled={isMonitoringImporting}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-600 disabled:opacity-60"
                  >
                    {isMonitoringImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {isMonitoringImporting ? "Memeriksa..." : "Pilih Workbook SPANExt"}
                  </button>
                  <input
                    ref={monitoringImportInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={isMonitoringImporting}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void checkMonitoringWorkbook(file);
                      event.target.value = "";
                    }}
                  />
                  {monitoringImportSummary && (
                    <button
                      type="button"
                      onClick={() => setMonitoringImportSummary(null)}
                      className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
                    >
                      Reset file
                    </button>
                  )}
                </div>

                {monitoringImportError && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600">
                    {monitoringImportError}
                  </div>
                )}

                {monitoringImportSummary ? (
                  <>
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-700">
                      {monitoringImportSummary.fileName} · {monitoringImportSummary.totalRows} baris · {monitoringImportSummary.eligibleRows} eligible non-final
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">File</div>
                        <div className="font-black mt-1 break-all leading-tight">{monitoringImportSummary.fileName}</div>
                      </div>
                      <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Rows</div>
                        <div className="font-black mt-1">{monitoringImportSummary.totalRows}</div>
                      </div>
                      <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Eligible</div>
                        <div className="font-black mt-1">{monitoringImportSummary.eligibleRows}</div>
                      </div>
                      <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Total eligible</div>
                        <div className="font-black mt-1 break-all leading-tight text-[clamp(1rem,1.2vw,1.35rem)]">
                          Rp{new Intl.NumberFormat("id-ID").format(monitoringImportSummary.totalEligibleAmount)}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Excluded</div>
                        <div className="font-black mt-1">{monitoringImportSummary.excludedRows}</div>
                      </div>
                      <div className="min-w-0 overflow-hidden rounded-xl bg-background p-4 border border-border">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Recipient unik</div>
                        <div className="font-black mt-1">{monitoringImportSummary.uniqueRecipients}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-background/50 p-6 text-sm text-muted-foreground">
                    Upload workbook monitoring SP2D dari SPANExt dulu untuk membaca baris eligible non-final.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4 flex flex-col gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">Preview baris</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Baris eligible akan dipakai sebagai kandidat transaksi non-final dan dicocokkan ke nama penerima di master PTKP.
                  </div>
                </div>
                <div className="max-h-[34rem] overflow-y-auto rounded-2xl border border-border bg-background">
                  {monitoringImportSummary?.rows?.length ? (
                    <div className="divide-y divide-border overflow-hidden">
                      {monitoringImportSummary.rows.map((row) => (
                        <div key={`${row.rowNumber}-${row.noSp2d || row.namaPenerima}`} className="p-4 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-black break-words leading-tight">
                                {row.noSp2d || "-"} · {row.namaPenerima || "-"}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 break-words leading-relaxed">
                                Baris {row.rowNumber} · {row.tanggalSp2d || "-"} · {row.jenisSpm || "-"}
                              </div>
                            </div>
                            <span className={`badge ${row.isEligible ? "badge-completed" : "bg-rose-500/10! text-rose-600!"}`}>
                              {row.isEligible ? "ELIGIBLE" : "EXCLUDED"}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-3 text-xs">
                            <div className="rounded-xl bg-muted/40 p-3">
                              <div className="uppercase font-bold text-muted-foreground">Jumlah</div>
                              <div className="font-black mt-1">Rp{new Intl.NumberFormat("id-ID").format(row.jumlah)}</div>
                            </div>
                            <div className="rounded-xl bg-muted/40 p-3">
                              <div className="uppercase font-bold text-muted-foreground">Match Master</div>
                              <div className="font-black mt-1">{row.matchedRecipientName || "-"}</div>
                            </div>
                            <div className="rounded-xl bg-muted/40 p-3">
                              <div className="uppercase font-bold text-muted-foreground">Keterangan</div>
                              <div className="font-black mt-1 break-words leading-tight">
                                {row.isEligible ? "Masuk kandidat non-final" : row.excludeReason || "Tidak eligible"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">Belum ada file yang diunggah.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card min-w-0 max-w-full overflow-hidden transition-all duration-500 shadow-xl border-white/5">
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="premium-table min-w-[1500px]">
            <thead>
              <tr>
                <th className="p-4 text-center">
                  <input type="checkbox" className="w-4 h-4 rounded-md accent-accent cursor-pointer" checked={isAllOnPageSelected} onChange={(e) => toggleSelectAll(e.target.checked)}/>
                </th>
                <SortHeader label={t.worksheet.spm_detail} sortKey="spm" />
                <SortHeader label={t.worksheet.spm_description} sortKey="description" />
                <SortHeader label={t.worksheet.sp2d_detail} sortKey="sp2d" />
                <SortHeader label={t.worksheet.account_code} sortKey="akun" />
                <SortHeader label={t.worksheet.recipient_amount} sortKey="recipient" />
                <SortHeader label={t.worksheet.deadline} sortKey="deadline" />
                <SortHeader label={t.worksheet.assignee} sortKey="assignee" />
                <th className="text-center font-semibold text-xs uppercase tracking-widest p-4">{t.worksheet.status}</th>
                <th className="text-center font-semibold text-xs uppercase tracking-widest p-4">PPh 21 Process</th>
                <th className="text-center font-semibold text-xs uppercase tracking-widest p-4">{t.worksheet.action}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeletonRows columns={11} rows={8} />
              ) : totalRecords === 0 ? (
                <tr><td colSpan={11} className="text-center p-12 text-muted-foreground italic">{t.worksheet.not_found}</td></tr>
              ) : (
                paginatedRecords.map((record) => {
                  const deadline = getDeadlineStatus(record);
                  const accountLabel = getTaxAccountLabel(record.accountCode);
                  const isSelected = selectedIds.has(record.id);
                  return (
                    <tr key={record.id} className={`animate-in fade-in slide-in-from-left-2 duration-300 transition-colors ${isSelected ? "bg-accent/5" : ""}`}>
                      <td className="text-center p-4">
                        <input type="checkbox" className="w-4 h-4 rounded-md accent-accent cursor-pointer" checked={isSelected} onChange={() => toggleSelectRecord(record.id)}/>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1 text-left">
                          <button onClick={() => openDetailModal(record)} className="font-bold text-accent hover:underline text-left transition-all hover:scale-[1.02] active:scale-95">{record.spmNumber}</button>
                          <span className="text-xs text-muted-foreground flex items-center gap-2 font-medium opacity-70"><Calendar size={12} /> {new Date(record.spmDate).toLocaleDateString(language === "ID" ? "id-ID" : "en-US", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td><div className="flex items-start gap-2 max-w-[250px] text-left"><FileText size={14} className="text-muted-foreground shrink-0 mt-1" /><span className="text-xs leading-relaxed line-clamp-3">{record.description || "-"}</span></div></td>
                      <td><div className="flex flex-col gap-1 text-left"><span className="font-medium text-sm">{record.sp2dNumber || "-"}</span><span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar size={10} /> {record.sp2dDate ? new Date(record.sp2dDate).toLocaleDateString(language === "ID" ? "id-ID" : "en-US", { day: 'numeric', month: 'short', year: 'numeric' }) : (language === "ID" ? "Belum terbit" : "Not issued")}</span></div></td>
                      <td className="text-center"><div className="flex flex-col items-center gap-1.5 group cursor-help"><span className="badge bg-accent/5 text-accent border border-accent/10 font-mono text-xs shadow-sm">{record.accountCode}</span><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight text-center max-w-[80px] leading-tight opacity-70 group-hover:opacity-100 transition-opacity">{accountLabel}</span></div></td>
                      <td><div className="flex flex-col gap-1 text-left"><span className="font-medium text-sm line-clamp-1 max-w-[200px]">{record.recipient}</span><div className="flex flex-col text-left"><span className="text-xs font-bold text-accent">{language === "ID" ? "Potongan" : "Tax"}: IDR {record.deductionAmount.toLocaleString("id-ID")}</span><span className="text-[10px] opacity-70">Total: IDR {record.totalValue?.toLocaleString("id-ID") || "0"}</span></div></div></td>
                      <td className="text-center"><div className={`p-2 rounded-xl flex flex-col items-center gap-1 ${deadline.type === "overdue" ? "bg-rose-500/10 text-rose-500" : deadline.type === "soon" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">{deadline.type === "overdue" ? <AlertCircle size={12} /> : <Clock size={12} />}{deadline.label.includes(t.worksheet.terlewat) ? t.worksheet.terlewat : deadline.label.includes(t.worksheet.segera) ? t.worksheet.segera : t.worksheet.aman}</div><span className="text-xs font-medium">{deadline.label}</span></div></td>
                      <td className="text-center"><select className="bg-muted border-none rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-accent cursor-pointer w-full max-w-[140px] transition-all text-center font-bold" value={record.assigneeId || ""} onChange={(e) => assignColleague(record.id, e.target.value ? Number(e.target.value) : 0)}><option value="">{t.worksheet.unassigned}</option>{colleagues.map((col: Colleague) => (<option key={col.id} value={col.id}>{col.name}</option>))}</select></td>
                      <td className="text-center"><div className={`badge ${record.status === "COMPLETED" ? "badge-completed" : record.status === "ISSUES" ? "bg-amber-500/10! text-amber-500! border-amber-500/20!" : "badge-pending"}`}>{record.status === "COMPLETED" ? t.worksheet.completed : record.status === "ISSUES" ? t.worksheet.issues : t.worksheet.pending}</div></td>
                      <td className="text-center">
                        {record.accountCode === "411121" ? (
                          <div className="flex flex-col items-center gap-2">
                            <span className={`badge ${getPph21BadgeClass(record.pph21Batch?.status)}`}>{getPph21StatusLabel(record.pph21Batch?.status)}</span>
                            <button
                              type="button"
                              onClick={() => openUpdateModal(record)}
                              className="text-[10px] font-black uppercase text-accent hover:underline"
                              title="Buka rincian PPh 21 di halaman yang sama"
                            >
                              Kelola rincian
                            </button>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {record.status !== "COMPLETED" ? (
                            <button onClick={() => openUpdateModal(record)} className={`p-2 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 rounded-lg transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-tight ${record.status === "ISSUES" ? "text-amber-500" : ""}`} title={t.worksheet.mark_done}><Check size={16} /> {record.status === "ISSUES" ? t.worksheet.save : t.worksheet.mark_done}</button>
                          ) : (
                            <div className="flex flex-col items-center gap-1 p-2">
                              {record.docLink && (<a href={record.docLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center gap-1 font-black uppercase tracking-widest"><ExternalLink size={10} /> {language === "ID" ? "Lihat" : "View"}</a>)}
                              {record.notes && (<span className="text-[10px] text-muted-foreground italic max-w-[120px] truncate" title={record.notes}>“{record.notes}”</span>)}
                              <button onClick={() => updateStatus(record.id, "PENDING")} className="text-[10px] text-rose-500 hover:underline mt-1 font-bold">{t.worksheet.revert}</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalRecords > 0 && (
          <div className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-bold">
              <div className="flex items-center gap-2"><span>{t.worksheet.rows_per_page}:</span><select className="bg-muted border-none rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-accent cursor-pointer" value={rowsPerPage} onChange={(e) => { const val = e.target.value === "max" ? "max" : Number(e.target.value); setRowsPerPage(val); setCurrentPage(1); }}><option value={5}>5</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value="max">{t.worksheet.show_all}</option></select></div>
              <div className="whitespace-nowrap">{rowsPerPage === "max" ? (<span>{records.length} {t.worksheet.of} {totalRecords}</span>) : (<span>{(currentPage - 1) * (rowsPerPage as number) + 1} - {Math.min(currentPage * (rowsPerPage as number), totalRecords)} {t.worksheet.of} {totalRecords}</span>)}</div>
            </div>
            {rowsPerPage !== "max" && (<div className="flex items-center gap-2"><button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-accent/10 disabled:opacity-20 transition-colors"><ChevronsLeft size={16} /></button><div className="flex items-center gap-1">{Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => { if (totalPages <= 7) return true; if (p === 1 || p === totalPages) return true; return Math.abs(p - currentPage) <= 1; }).map((p, i, arr) => (<div key={p} className="flex items-center">{i > 0 && p - arr[i-1] > 1 && <span className="px-2 text-muted-foreground opacity-50">...</span>}<button onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === p ? "bg-accent text-white shadow-lg shadow-accent/20" : "hover:bg-accent/10 text-muted-foreground"}`}>{p}</button></div>))}</div><button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-accent/10 disabled:opacity-20 transition-colors"><ChevronsRight size={16} /></button></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
