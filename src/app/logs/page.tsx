"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { History, Search, Download, FileJson, Copy, Check, ChevronDown, Clock, Calendar, ShieldCheck, KeyRound, Database, Activity, Filter, Info, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

export default function LogsPage() {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/logs");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ["Timestamp", "User", "Action", "Target", "Category", "Type"];
    const rows = logs.map(log => [
      new Date(log.createdAt).toLocaleString(), 
      log.userName, 
      `"${log.action}"`, 
      `"${log.target}"`,
      log.category || "GENERAL",
      log.type
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `bupot_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportMenuOpen(false);
  };

  const handleExportJSON = () => {
    if (logs.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const link = document.createElement("a");
    link.href = dataStr;
    link.setAttribute("download", `bupot_logs_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportMenuOpen(false);
  };

  const handleCopyJSON = () => {
    if (logs.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
    setIsExportMenuOpen(false);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.target.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = categoryFilter === "ALL" || log.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [logs, search, categoryFilter]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "AUTH": return <KeyRound size={12} />;
      case "DATA": return <Database size={12} />;
      case "ADMIN": return <ShieldCheck size={12} />;
      case "SECURITY": return <Activity size={12} />;
      default: return <History size={12} />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "danger": return <AlertCircle size={14} />;
      case "warning": return <AlertTriangle size={14} />;
      case "success": return <CheckCircle2 size={14} />;
      default: return <Info size={14} />;
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <header className="flex flex-col gap-2 text-left">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <History className="text-accent" /> {t.nav.log_aktivitas}
        </h1>
        <p className="text-muted-foreground">Monitor riwayat perubahan dan aktivitas sistem secara transparan dengan kategorisasi detail.</p>
      </header>

      <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
             <input 
               type="text" 
               placeholder="Cari berdasarkan pengguna, aksi, atau target..." 
               className="w-full bg-muted border-none rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
          </div>
          
          <div className="relative min-w-[150px]">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
             <select 
               className="w-full bg-muted border-none rounded-xl pl-10 pr-10 py-3 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer transition-all"
               value={categoryFilter}
               onChange={(e) => setCategoryFilter(e.target.value)}
             >
                <option value="ALL">{language === "ID" ? "Semua Kategori" : "All Categories"}</option>
                <option value="AUTH">Authentication</option>
                <option value="DATA">Data Management</option>
                <option value="ADMIN">Administrative</option>
                <option value="SECURITY">Security/Audit</option>
                <option value="GENERAL">General</option>
             </select>
             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
          </div>

          <div className="relative min-w-[200px]">
             <button 
               onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
               disabled={logs.length === 0}
               className="w-full bg-accent text-accent-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-accent/20 disabled:opacity-50 disabled:scale-100"
             >
               {copySuccess ? <Check size={18} /> : <Download size={18} />}
               {copySuccess ? "Copied!" : (language === "ID" ? "Ekspor Data" : "Export Data")}
               <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? "rotate-180" : ""}`} />
             </button>

             {isExportMenuOpen && (
               <div className="absolute top-full right-0 mt-2 w-full glass-card bg-background/95 backdrop-blur-xl border border-border/50 p-2 z-50 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                 <button onClick={handleExportCSV} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-sm font-medium transition-colors">
                   <Download size={16} className="text-emerald-500" /> Download .CSV
                 </button>
                 <button onClick={handleExportJSON} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-sm font-medium transition-colors">
                   <FileJson size={16} className="text-blue-500" /> Download .JSON
                 </button>
                 <div className="my-1 h-px bg-border/50" />
                 <button onClick={handleCopyJSON} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-sm font-medium transition-colors">
                   <Copy size={16} className="text-purple-500" /> Copy as JSON
                 </button>
               </div>
             )}
          </div>
      </div>

      <div className="glass-card overflow-hidden transition-all duration-300 shadow-xl border-white/5">
        <div className="overflow-x-auto">
          <table className="premium-table w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-muted font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                <th className="p-4 px-6">Timestamp</th>
                <th className="p-4">Pengguna</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Aktivitas</th>
                <th className="p-4">Objek/Target</th>
                <th className="p-4 text-center">Tipe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {isLoading ? (
                <tr><td colSpan={6} className="p-20 text-center text-muted-foreground animate-pulse italic font-bold">Memperbarui data audit...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={6} className="p-20 text-center text-muted-foreground italic font-semibold">Belum ada aktivitas yang tercatat untuk filter ini.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/20 transition-colors group">
                    <td className="p-4 px-6 text-xs text-muted-foreground flex flex-col">
                      <span className="flex items-center gap-1.5 font-bold tabular-nums"><Clock size={10} className="text-accent" /> {new Date(log.createdAt).toLocaleTimeString()}</span>
                      <span className="flex items-center gap-1.5 mt-0.5 opacity-60 font-medium"><Calendar size={10} /> {new Date(log.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="p-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-xs">
                             {log.userName.charAt(0)}
                          </div>
                          <span className="text-sm font-black">{log.userName}</span>
                       </div>
                    </td>
                    <td className="p-4">
                       <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                          {getCategoryIcon(log.category)}
                          {log.category || "GENERAL"}
                       </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-foreground/90">{log.action}</td>
                    <td className="p-4">
                       <div className="flex items-center gap-2 max-w-[200px] overflow-hidden">
                          <span className="text-[11px] font-bold text-accent truncate bg-accent/5 px-2 py-1 rounded-lg border border-accent/10">{log.target}</span>
                       </div>
                    </td>
                    <td className="p-4">
                       <div className="flex justify-center">
                          <div 
                            className={`flex items-center gap-2 p-2 rounded-xl transition-all shadow-sm ${
                              log.type === 'danger' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                              log.type === 'warning' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                              log.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                              'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            }`}
                            title={log.type}
                          >
                             {getTypeIcon(log.type)}
                             <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{log.type}</span>
                          </div>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-6 md:p-8 flex items-center justify-between bg-muted/10 border-t border-border/5">
          <div className="text-muted-foreground italic text-[10px] uppercase tracking-[0.2em] font-black opacity-60">
            {isLoading ? "PROCESSING..." : `TOTAL ENTRIES: ${filteredLogs.length}`}
          </div>
          <button 
            onClick={fetchLogs}
            className="text-[11px] font-black text-accent hover:brightness-110 uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh Activity Stream
          </button>
        </div>
      </div>
    </div>
  );
}

function RefreshCw({ size, className }: { size: number, className: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
