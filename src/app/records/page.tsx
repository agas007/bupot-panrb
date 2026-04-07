"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { 
  Search, Filter, ChevronDown, Calendar, 
  Clock, ArrowUpDown, Check, 
  ExternalLink, X, ClipboardCheck,
  ChevronsLeft, ChevronsRight,
  User, CheckCircle2, FileText, Hash,
  Landmark, Download, FileJson, Table, FileType,
  CalendarRange, AlertCircle, RefreshCw
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { getTaxAccountLabel } from "@/lib/tax-codes";
import { SPMRecord, Colleague } from "@/types";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export default function RecordsPage() {
  const { language, t } = useLanguage();
  const { getAuthHeaders } = useAuth();
  
  const [records, setRecords] = useState<SPMRecord[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Sorting states
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | "max">(25);

  const [selectedRecord, setSelectedRecord] = useState<SPMRecord | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ docLink: "", notes: "" });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];
    
    // Text Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(record => {
        const deductionStr = record.deductionAmount.toString();
        const totalValueStr = record.totalValue?.toString() || "";
        const descriptionStr = record.description?.toLowerCase() || "";
        const kapDescription = getTaxAccountLabel(record.accountCode).toLowerCase();
        return (
          record.spmNumber?.toLowerCase().includes(query) ||
          (record.sp2dNumber || "").toLowerCase().includes(query) ||
          record.recipient?.toLowerCase().includes(query) ||
          descriptionStr.includes(query) ||
          deductionStr.includes(query) ||
          totalValueStr.includes(query) ||
          record.accountCode?.includes(query) ||
          kapDescription.includes(query)
        );
      });
    }

    // Category Filters
    if (accountFilter !== "all") result = result.filter(r => r.accountCode === accountFilter);
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") result = result.filter(r => !r.assigneeId);
      else result = result.filter(r => r.assigneeId === Number(assigneeFilter));
    }
    if (statusFilter !== "all") result = result.filter(r => r.status === statusFilter);
    
    // 🔥 NEW: Advanced Date Range Filtering
    if (startDate) {
      const start = new Date(startDate).getTime();
      result = result.filter(r => new Date(r.spmDate).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endTs = end.getTime();
      result = result.filter(r => new Date(r.spmDate).getTime() <= endTs);
    }

    // Sorting Logic
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortConfig.key) {
          case 'spm': aVal = a.spmNumber; bVal = b.spmNumber; break;
          case 'description': aVal = a.description || ""; bVal = b.description || ""; break;
          case 'sp2d': aVal = a.sp2dNumber || ""; bVal = b.sp2dNumber || ""; break;
          case 'akun': aVal = a.accountCode; bVal = b.accountCode; break;
          case 'recipient': aVal = a.recipient || ""; bVal = b.recipient || ""; break;
          case 'assignee': 
            aVal = colleagues.find(c => c.id === a.assigneeId)?.name || "";
            bVal = colleagues.find(c => c.id === b.assigneeId)?.name || "";
            break;
          case 'deadline':
            aVal = a.sp2dDate ? new Date(a.sp2dDate).getTime() : 0;
            bVal = b.sp2dDate ? new Date(b.sp2dDate).getTime() : 0;
            break;
          default: aVal = 0; bVal = 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [records, searchQuery, accountFilter, assigneeFilter, statusFilter, startDate, endDate, sortConfig, colleagues]);

  const paginatedRecords = useMemo(() => {
    if (rowsPerPage === "max") return filteredAndSortedRecords;
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredAndSortedRecords.slice(start, end);
  }, [filteredAndSortedRecords, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    if (rowsPerPage === "max") return 1;
    return Math.ceil(filteredAndSortedRecords.length / rowsPerPage);
  }, [filteredAndSortedRecords, rowsPerPage]);

  const isAllOnPageSelected = useMemo(() => {
    if (paginatedRecords.length === 0) return false;
    return paginatedRecords.every(r => selectedIds.has(r.id));
  }, [paginatedRecords, selectedIds]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recRes, colRes] = await Promise.all([
        fetch("/api/records"),
        fetch("/api/colleagues")
      ]);
      const [recData, colData] = await Promise.all([recRes.json(), colRes.json()]);
      setRecords(recData);
      setColleagues(colData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const openUpdateModal = (record: SPMRecord) => {
    setSelectedRecord(record);
    setUpdateForm({ docLink: record.docLink || "", notes: record.notes || "" });
    setIsUpdateModalOpen(true);
  };

  const openDetailModal = (record: SPMRecord) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
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
        body: JSON.stringify({ id: selectedRecord.id, status: "COMPLETED", ...updateForm }),
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

  const uniqueAccounts = ["411121", "411122", "411124"];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, accountFilter, assigneeFilter, statusFilter, startDate, endDate, sortConfig]);

  // Export Functions
  const exportToExcel = () => {
    const data = filteredAndSortedRecords.map(r => ({
      SPM: r.spmNumber,
      Tanggal_SPM: new Date(r.spmDate).toLocaleDateString(),
      Account: r.accountCode,
      Potongan: r.deductionAmount,
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
    const headers = ["SPM", "Tanggal SPM", "Account", "Potongan", "Penerima", "Status", "Petugas"];
    const rows = filteredAndSortedRecords.map(r => [
      r.spmNumber,
      new Date(r.spmDate).toLocaleDateString(),
      r.accountCode,
      r.deductionAmount,
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
    const headers = [["SPM", "Date", "Account", "Amount", "Recipient", "Status", "Assignee"]];
    const data = filteredAndSortedRecords.map(r => [
      r.spmNumber,
      new Date(r.spmDate).toLocaleDateString(),
      r.accountCode,
      r.deductionAmount.toLocaleString(),
      r.recipient || "-",
      r.status,
      colleagues.find(c => c.id === r.assigneeId)?.name || "Unassigned"
    ]);

    doc.text("Bupot PANRB - Worksheet Report", 40, 40);
    // @ts-ignore
    doc.autoTable({
      head: headers,
      body: data,
      startY: 60,
      theme: 'grid',
      styles: { fontSize: 8 }
    });
    doc.save(`Bupot_PANRB_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const SortHeader = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => (
    <th className={`cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors group p-4 ${className}`} onClick={() => handleSort(sortKey)}>
      <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-semibold">
        {label}
        <ArrowUpDown size={14} className={`transition-opacity ${sortConfig?.key === sortKey ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-40"}`} />
      </div>
    </th>
  );

  const resetFilters = () => {
    setSearchQuery("");
    setAccountFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Update/Completion Modal (Same as before) */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-1000">
          <div className="glass-card p-8 rounded-3xl w-full max-w-md flex flex-col gap-6 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center text-left">
              <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="text-accent" /> {t.worksheet.modal_title}</h2>
              <button onClick={() => setIsUpdateModalOpen(false)} className="text-muted-foreground hover:text-foreground p-1 transition-colors"><X size={24}/></button>
            </div>
            <div className="flex flex-col gap-4 text-left">
              <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{t.worksheet.doc_link}</label><input className="w-full bg-muted border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all" value={updateForm.docLink} onChange={e => setUpdateForm({...updateForm, docLink: e.target.value})} /></div>
              <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{t.worksheet.notes}</label><textarea className="w-full bg-muted border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all min-h-[100px]" value={updateForm.notes} onChange={e => setUpdateForm({...updateForm, notes: e.target.value})} /></div>
            </div>
            <button onClick={submitUpdate} className="premium-button font-bold text-sm py-4 flex items-center justify-center gap-2"><Check size={18} /> {t.worksheet.save}</button>
          </div>
        </div>
      )}

      {/* Detail Modal (Same as before) */}
      {isDetailModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-1000">
          <div className="glass-card p-8 rounded-3xl w-full max-w-2xl flex flex-col gap-8 shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center bg-muted/-5 p-2 rounded-2xl">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-accent/10 rounded-2xl text-accent"><Hash size={24} /></div>
                 <div className="text-left"><h2 className="text-2xl font-bold tracking-tight">{selectedRecord.spmNumber}</h2><p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">{t.worksheet.spm_detail}</p></div>
               </div>
               <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-all"><X size={24} /></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
               <div className="flex flex-col gap-6">
                 <div><label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t.worksheet.account_code}</label><div className="flex items-center gap-3"><span className="badge bg-accent/10 text-accent border border-accent/20 text-sm py-1.5 px-4">{selectedRecord.accountCode}</span><span className="text-xs font-bold opacity-70">{getTaxAccountLabel(selectedRecord.accountCode)}</span></div></div>
                 <div><label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t.worksheet.recipient_amount}</label><div className="p-4 bg-muted/30 rounded-2xl border border-border/50"><p className="font-bold text-lg mb-1">{selectedRecord.recipient}</p><div className="flex flex-col gap-1"><div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">{language === "ID" ? "Nilai SPM" : "SPM Amount"}</span><span className="font-mono font-bold text-slate-500">IDR {selectedRecord.totalValue?.toLocaleString("id-ID") || "0"}</span></div><div className="flex justify-between items-center text-base"><span className="font-medium">{language === "ID" ? "Potongan Pajak" : "Tax Deduction"}</span><span className="font-mono font-bold text-accent">IDR {selectedRecord.deductionAmount.toLocaleString("id-ID")}</span></div></div></div></div>
                 <div><label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t.worksheet.spm_description}</label><p className="text-sm leading-relaxed italic text-muted-foreground bg-accent/5 p-4 rounded-2xl border border-accent/10">"{selectedRecord.description || "-"}"</p></div>
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
                 <div className="flex flex-col gap-4 border-t border-border pt-6"><div className="flex items-center justify-between"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.worksheet.status}</span><div className={`badge ${selectedRecord.status === "COMPLETED" ? "badge-completed" : "badge-pending"}`}>{selectedRecord.status === "COMPLETED" ? t.worksheet.completed : t.worksheet.pending}</div></div><div className="flex items-center justify-between"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.worksheet.assignee}</span><span className="text-sm font-medium">{colleagues.find(c => c.id === selectedRecord.assigneeId)?.name || t.worksheet.unassigned}</span></div></div>
                 {selectedRecord.notes && (<div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10"><label className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2"><FileText size={14} /> {t.worksheet.notes}</label><p className="text-xs italic text-muted-foreground leading-relaxed">{selectedRecord.notes}</p></div>)}
                 {selectedRecord.docLink && (<a href={selectedRecord.docLink} target="_blank" rel="noopener noreferrer" className="premium-button text-xs py-3 flex items-center justify-center gap-2 bg-emerald-600"><ExternalLink size={14} /> {language === "ID" ? "Buka Link Bukti Potong" : "Open Tax Receipt Link"}</a>)}
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar (Same as before) */}
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

        {/* Search & Basic Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input type="text" placeholder={t.worksheet.search_placeholder} className="w-full bg-muted border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
          <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}><option value="all">{t.worksheet.all_accounts}</option>{uniqueAccounts.map(acc => (<option key={acc} value={acc}>{acc} ({getTaxAccountLabel(acc)})</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}><option value="all">{t.nav.daftar_rekan} ({t.worksheet.show_all})</option><option value="unassigned">{t.worksheet.unassigned}</option>{colleagues.map((col: Colleague) => (<option key={col.id} value={col.id}>{col.name}</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          <div className="relative"><CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">{t.worksheet.status} ({t.worksheet.show_all})</option><option value="PENDING">{t.worksheet.pending}</option><option value="COMPLETED">{t.worksheet.completed}</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          
          {(searchQuery || accountFilter !== "all" || assigneeFilter !== "all" || statusFilter !== "all" || startDate || endDate) && (
            <button onClick={resetFilters} className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 transition-all" title="Reset semua filter">
              <RefreshCw size={18} />
            </button>
          )}
        </div>

        {/* 🔥 NEW: Advanced Search Panel (Date Range) */}
        {showAdvancedFilters && (
          <div className="glass-card p-6 border-accent/20 animate-in slide-in-from-top-4 duration-300">
             <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex flex-col gap-2 flex-1 text-left">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rentang Tanggal SPM (Mulai)</label>
                   <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                      <input type="date" className="w-full bg-muted/50 border-none py-3 pl-12 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 transition-all font-bold text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                   </div>
                </div>
                <div className="flex flex-col gap-2 flex-1 text-left">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rentang Tanggal SPM (Selesai)</label>
                   <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                      <input type="date" className="w-full bg-muted/50 border-none py-3 pl-12 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 transition-all font-bold text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                   </div>
                </div>
                <div className="h-full flex items-end">
                   <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10 flex items-center gap-3">
                      <AlertCircle className="text-accent" size={18} />
                      <span className="text-[10px] uppercase font-black tracking-tighter opacity-70">Filtering by SPM Issuance Date</span>
                   </div>
                </div>
             </div>
          </div>
        )}
      </header>

      <div className="glass-card overflow-hidden transition-all duration-500 shadow-xl border-white/5">
        <div className="overflow-x-auto">
          <table className="premium-table">
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
                <th className="text-center font-semibold text-xs uppercase tracking-widest p-4">{t.worksheet.action}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="text-center p-12 text-muted-foreground italic">{t.worksheet.loading}</td></tr>
              ) : filteredAndSortedRecords.length === 0 ? (
                <tr><td colSpan={10} className="text-center p-12 text-muted-foreground italic">{t.worksheet.not_found}</td></tr>
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
                      <td className="text-center"><div className={`badge ${record.status === "COMPLETED" ? "badge-completed" : "badge-pending"}`}>{record.status === "COMPLETED" ? t.worksheet.completed : t.worksheet.pending}</div></td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {record.status === "PENDING" ? (
                            <button onClick={() => openUpdateModal(record)} className="p-2 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 rounded-lg transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-tight" title={t.worksheet.mark_done}><Check size={16} /> {t.worksheet.mark_done}</button>
                          ) : (
                            <div className="flex flex-col items-center gap-1 p-2">
                              {record.docLink && (<a href={record.docLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center gap-1 font-black uppercase tracking-widest"><ExternalLink size={10} /> {language === "ID" ? "Lihat" : "View"}</a>)}
                              {record.notes && (<span className="text-[10px] text-muted-foreground italic max-w-[120px] truncate" title={record.notes}>"{record.notes}"</span>)}
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

        {!isLoading && filteredAndSortedRecords.length > 0 && (
          <div className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-bold">
              <div className="flex items-center gap-2"><span>{t.worksheet.rows_per_page}:</span><select className="bg-muted border-none rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-accent cursor-pointer" value={rowsPerPage} onChange={(e) => { const val = e.target.value === "max" ? "max" : Number(e.target.value); setRowsPerPage(val); setCurrentPage(1); }}><option value={5}>5</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value="max">{t.worksheet.show_all}</option></select></div>
              <div className="whitespace-nowrap">{rowsPerPage === "max" ? (<span>{filteredAndSortedRecords.length} {t.worksheet.of} {filteredAndSortedRecords.length}</span>) : (<span>{(currentPage - 1) * (rowsPerPage as number) + 1} - {Math.min(currentPage * (rowsPerPage as number), filteredAndSortedRecords.length)} {t.worksheet.of} {filteredAndSortedRecords.length}</span>)}</div>
            </div>
            {rowsPerPage !== "max" && (<div className="flex items-center gap-2"><button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-accent/10 disabled:opacity-20 transition-colors"><ChevronsLeft size={16} /></button><div className="flex items-center gap-1">{Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => { if (totalPages <= 7) return true; if (p === 1 || p === totalPages) return true; return Math.abs(p - currentPage) <= 1; }).map((p, i, arr) => (<div key={p} className="flex items-center">{i > 0 && p - arr[i-1] > 1 && <span className="px-2 text-muted-foreground opacity-50">...</span>}<button onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === p ? "bg-accent text-white shadow-lg shadow-accent/20" : "hover:bg-accent/10 text-muted-foreground"}`}>{p}</button></div>))}</div><button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-accent/10 disabled:opacity-20 transition-colors"><ChevronsRight size={16} /></button></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
