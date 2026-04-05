"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { 
  Search, Filter, ChevronDown, Calendar, 
  Clock, AlertCircle, ArrowUpDown, Check, 
  ExternalLink, X, ClipboardCheck,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  User, CheckCircle2, FileText, Info, Hash,
  Wallet, Landmark, ReceiptText, Tag,
  MinusCircle, Trash2, ArrowRight
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { getTaxAccountLabel } from "@/lib/tax-codes";

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export default function RecordsPage() {
  const { language, t } = useLanguage();
  const [records, setRecords] = useState<any[]>([]);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Sorting states
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | "max">(25);

  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ docLink: "", notes: "" });

  // 1. Data Processing Logic (Must be before functions that use them)
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];
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
    if (accountFilter !== "all") result = result.filter(r => r.accountCode === accountFilter);
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") result = result.filter(r => !r.assigneeId);
      else result = result.filter(r => r.assigneeId === Number(assigneeFilter));
    }
    if (statusFilter !== "all") result = result.filter(r => r.status === statusFilter);
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal, bVal;
        switch (sortConfig.key) {
          case 'spm': aVal = a.spmNumber; bVal = b.spmNumber; break;
          case 'description': aVal = a.description || ""; bVal = b.description || ""; break;
          case 'sp2d': aVal = a.sp2dNumber || ""; bVal = b.sp2dNumber || ""; break;
          case 'akun': aVal = a.accountCode; bVal = b.accountCode; break;
          case 'recipient': aVal = a.recipient; bVal = b.recipient; break;
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
  }, [records, searchQuery, accountFilter, assigneeFilter, statusFilter, sortConfig, colleagues]);

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

  const openUpdateModal = (record: any) => {
    setSelectedRecord(record);
    setUpdateForm({ docLink: record.docLink || "", notes: record.notes || "" });
    setIsUpdateModalOpen(true);
  };

  const openDetailModal = (record: any) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const submitUpdate = async () => {
    try {
      const res = await fetch("/api/records", {
        method: "PATCH",
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

  const getDeadlineStatus = (sp2dDate: string) => {
    if (!sp2dDate) return { label: "N/A", type: "neutral", date: null };
    const date = new Date(sp2dDate);
    const targetDate = new Date(date.getFullYear(), date.getMonth() + 1, 15);
    const today = new Date();
    const diff = targetDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diff / (1000 * 3600 * 24));
    if (daysLeft < 0) return { label: `${t.worksheet.terlewat} (${Math.abs(daysLeft)} ${t.worksheet.days_overdue})`, type: "overdue", date: targetDate };
    if (daysLeft < 5) return { label: `${t.worksheet.segera} (${daysLeft} ${t.worksheet.days_left})`, type: "soon", date: targetDate };
    return { label: `Target: ${targetDate.toLocaleDateString(language === "ID" ? "id-ID" : "en-US", { day: 'numeric', month: 'long', year: 'numeric' })}`, type: "ok", date: targetDate };
  };

  const uniqueAccounts = useMemo(() => {
    const accounts = new Set(records.map(r => r.accountCode).filter(Boolean));
    return Array.from(accounts).sort();
  }, [records]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, accountFilter, assigneeFilter, statusFilter, sortConfig]);

  const SortHeader = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => (
    <th className={`cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors group p-4 ${className}`} onClick={() => handleSort(sortKey)}>
      <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-semibold">
        {label}
        <ArrowUpDown size={14} className={`transition-opacity ${sortConfig?.key === sortKey ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-40"}`} />
      </div>
    </th>
  );

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Update/Completion Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]">
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

      {/* Detail Modal */}
      {isDetailModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]">
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
                    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl"><Calendar className="text-muted-foreground" size={20} /><div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">{t.worksheet.deadline}</span><span className="text-sm font-bold text-rose-500">{getDeadlineStatus(selectedRecord.sp2dDate).label}</span></div></div>
                 </div>
                 <div className="flex flex-col gap-4 border-t border-border pt-6"><div className="flex items-center justify-between"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.worksheet.status}</span><div className={`badge ${selectedRecord.status === "COMPLETED" ? "badge-completed" : "badge-pending"}`}>{selectedRecord.status === "COMPLETED" ? t.worksheet.completed : t.worksheet.pending}</div></div><div className="flex items-center justify-between"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.worksheet.assignee}</span><span className="text-sm font-medium">{colleagues.find(c => c.id === selectedRecord.assigneeId)?.name || t.worksheet.unassigned}</span></div></div>
                 {selectedRecord.notes && (<div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10"><label className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2"><FileText size={14} /> {t.worksheet.notes}</label><p className="text-xs italic text-muted-foreground leading-relaxed">{selectedRecord.notes}</p></div>)}
                 {selectedRecord.docLink && (<a href={selectedRecord.docLink} target="_blank" rel="noopener noreferrer" className="premium-button text-xs py-3 flex items-center justify-center gap-2 bg-emerald-600"><ExternalLink size={14} /> {language === "ID" ? "Buka Link Bukti Potong" : "Open Tax Receipt Link"}</a>)}
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-300">
           <div className="bg-slate-900/90 text-white backdrop-blur-xl px-12 py-4 rounded-full shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/20 flex items-center gap-8 ring-8 ring-slate-900/10">
              <div className="flex items-center gap-10">
                <div className="flex flex-col items-center">
                  <span className="text-[20px] font-black tabular-nums leading-none mb-1">{selectedIds.size}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">{language === "ID" ? "TERPILIH" : "SELECTED"}</span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-white/60 uppercase tracking-widest">{language === "ID" ? "Tugaskan ke" : "Assign to"}</span>
                      <ArrowRight size={14} className="text-accent animate-pulse" />
                      <div className="relative group">
                         <select 
                           className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 px-6 rounded-full border-none outline-none cursor-pointer pr-10 appearance-none focus:ring-2 focus:ring-accent transition-all pl-10"
                           value=""
                           onChange={(e) => handleBulkAssign(e.target.value ? Number(e.target.value) : 0)}
                         >
                           <option value="" disabled className="text-slate-900">{language === "ID" ? "--- Pilih Rekan ---" : "--- Select Colleague ---"}</option>
                           <option value="0" className="text-slate-900">{t.worksheet.unassigned}</option>
                           {colleagues.map((col: any) => (<option key={col.id} value={col.id} className="text-slate-900">{col.name}</option>))}
                         </select>
                         <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                         <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={14} />
                      </div>
                   </div>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="group flex flex-col items-center justify-center p-1 rounded-lg hover:bg-white/10 transition-colors"
                title={language === "ID" ? "Batal pilih" : "Clear selection"}
              >
                <MinusCircle size={20} className="text-slate-400 group-hover:text-rose-400 transition-colors" />
                <span className="text-[8px] mt-1 font-bold uppercase tracking-tight opacity-40">CLEAR</span>
              </button>
           </div>
        </div>
      )}

      {/* Header with Multi-Filters */}
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-left">
          <h1 className="text-3xl font-bold tracking-tight">{t.worksheet.title}</h1>
          <p className="text-muted-foreground">{t.worksheet.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input type="text" placeholder={t.worksheet.search_placeholder} className="w-full bg-muted border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
          <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}><option value="all">{t.worksheet.all_accounts}</option>{uniqueAccounts.map(acc => (<option key={acc} value={acc}>{acc} ({getTaxAccountLabel(acc)})</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}><option value="all">{t.nav.daftar_rekan} ({t.worksheet.show_all})</option><option value="unassigned">{t.worksheet.unassigned}</option>{colleagues.map((col: any) => (<option key={col.id} value={col.id}>{col.name}</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
          <div className="relative"><CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><select className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all min-w-[140px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">{t.worksheet.status} ({t.worksheet.show_all})</option><option value="PENDING">{t.worksheet.pending}</option><option value="COMPLETED">{t.worksheet.completed}</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} /></div>
        </div>
      </header>

      <div className="glass-card overflow-hidden transition-all duration-500">
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th className="p-4 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded-md accent-accent cursor-pointer"
                    checked={isAllOnPageSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
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
                  const deadline = getDeadlineStatus(record.sp2dDate);
                  const accountLabel = getTaxAccountLabel(record.accountCode);
                  const isSelected = selectedIds.has(record.id);
                  return (
                    <tr key={record.id} className={`animate-in fade-in slide-in-from-left-2 duration-300 transition-colors ${isSelected ? "bg-accent/5" : ""}`}>
                      <td className="text-center p-4">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded-md accent-accent cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectRecord(record.id)}
                        />
                      </td>
                      <td>
                        <div className="flex flex-col gap-1 text-left">
                          <button onClick={() => openDetailModal(record)} className="font-bold text-accent hover:underline text-left transition-all hover:scale-[1.02] active:scale-95">{record.spmNumber}</button>
                          <span className="text-xs text-muted-foreground flex items-center gap-2"><Calendar size={12} /> {new Date(record.spmDate).toLocaleDateString(language === "ID" ? "id-ID" : "en-US", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td><div className="flex items-start gap-2 max-w-[250px] text-left"><FileText size={14} className="text-muted-foreground shrink-0 mt-1" /><span className="text-xs leading-relaxed line-clamp-3">{record.description || "-"}</span></div></td>
                      <td><div className="flex flex-col gap-1 text-left"><span className="font-medium text-sm">{record.sp2dNumber || "-"}</span><span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar size={10} /> {record.sp2dDate ? new Date(record.sp2dDate).toLocaleDateString(language === "ID" ? "id-ID" : "en-US", { day: 'numeric', month: 'short', year: 'numeric' }) : (language === "ID" ? "Belum terbit" : "Not issued")}</span></div></td>
                      <td className="text-center"><div className="flex flex-col items-center gap-1.5 group cursor-help"><span className="badge bg-accent/5 text-accent border border-accent/10 font-mono text-xs shadow-sm">{record.accountCode}</span><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight text-center max-w-[80px] leading-tight opacity-70 group-hover:opacity-100 transition-opacity">{accountLabel}</span></div></td>
                      <td><div className="flex flex-col gap-1 text-left"><span className="font-medium text-sm line-clamp-1 max-w-[200px]">{record.recipient}</span><div className="flex flex-col text-left"><span className="text-xs font-bold text-accent">{language === "ID" ? "Potongan" : "Tax"}: IDR {record.deductionAmount.toLocaleString("id-ID")}</span><span className="text-[10px] opacity-70">Total: IDR {record.totalValue?.toLocaleString("id-ID") || "0"}</span></div></div></td>
                      <td className="text-center"><div className={`p-2 rounded-xl flex flex-col items-center gap-1 ${deadline.type === "overdue" ? "bg-rose-500/10 text-rose-500" : deadline.type === "soon" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">{deadline.type === "overdue" ? <AlertCircle size={12} /> : <Clock size={12} />}{deadline.type === "overdue" ? t.worksheet.terlewat : deadline.type === "soon" ? t.worksheet.segera : t.worksheet.aman}</div><span className="text-xs font-medium">{deadline.label}</span></div></td>
                      <td className="text-center"><select className="bg-muted border-none rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-accent cursor-pointer w-full max-w-[140px] transition-all text-center" value={record.assigneeId || ""} onChange={(e) => assignColleague(record.id, e.target.value ? Number(e.target.value) : 0)}><option value="">{t.worksheet.unassigned}</option>{colleagues.map((col: any) => (<option key={col.id} value={col.id}>{col.name}</option>))}</select></td>
                      <td className="text-center"><div className={`badge ${record.status === "COMPLETED" ? "badge-completed" : "badge-pending"}`}>{record.status === "COMPLETED" ? t.worksheet.completed : t.worksheet.pending}</div></td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {record.status === "PENDING" ? (
                            <button onClick={() => openUpdateModal(record)} className="p-2 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium" title={t.worksheet.mark_done}><Check size={16} /> {t.worksheet.mark_done}</button>
                          ) : (
                            <div className="flex flex-col items-center gap-1 p-2">
                              {record.docLink && (<a href={record.docLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center gap-1 font-bold"><ExternalLink size={10} /> {language === "ID" ? "Lihat Dokumen" : "View Document"}</a>)}
                              {record.notes && (<span className="text-[10px] text-muted-foreground italic max-w-[120px] truncate" title={record.notes}>"{record.notes}"</span>)}
                              <button onClick={() => updateStatus(record.id, "PENDING")} className="text-[10px] text-rose-500 hover:underline mt-1 font-medium">{t.worksheet.revert}</button>
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

        {/* Pagination Footer */}
        {!isLoading && filteredAndSortedRecords.length > 0 && (
          <div className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><span>{t.worksheet.rows_per_page}:</span><select className="bg-muted border-none rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-accent cursor-pointer" value={rowsPerPage} onChange={(e) => { const val = e.target.value === "max" ? "max" : Number(e.target.value); setRowsPerPage(val); setCurrentPage(1); }}><option value={5}>5</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value="max">{t.worksheet.show_all}</option></select></div>
              <div className="font-medium whitespace-nowrap">{rowsPerPage === "max" ? (<span>{filteredAndSortedRecords.length} {t.worksheet.of} {filteredAndSortedRecords.length}</span>) : (<span>{(currentPage - 1) * (rowsPerPage as number) + 1} - {Math.min(currentPage * (rowsPerPage as number), filteredAndSortedRecords.length)} {t.worksheet.of} {filteredAndSortedRecords.length}</span>)}</div>
            </div>
            {rowsPerPage !== "max" && (<div className="flex items-center gap-2"><button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-accent/10 disabled:opacity-20 transition-colors"><ChevronsLeft size={16} /></button><div className="flex items-center gap-1">{Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => { if (totalPages <= 7) return true; if (p === 1 || p === totalPages) return true; return Math.abs(p - currentPage) <= 1; }).map((p, i, arr) => (<div key={p} className="flex items-center">{i > 0 && p - arr[i-1] > 1 && <span className="px-2 text-muted-foreground opacity-50">...</span>}<button onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === p ? "bg-accent text-white shadow-lg shadow-accent/20" : "hover:bg-accent/10 text-muted-foreground"}`}>{p}</button></div>))}</div><button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-accent/10 disabled:opacity-20 transition-colors"><ChevronsRight size={16} /></button></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
