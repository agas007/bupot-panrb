"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { History, Search, Download, FileJson, Copy, Check, ChevronDown, Clock, Calendar } from "lucide-react";
import { useState, useEffect } from "react";

export default function LogsPage() {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
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
    const headers = ["Timestamp", "User", "Action", "Target", "Type"];
    const rows = logs.map(log => [
      new Date(log.createdAt).toLocaleString(), 
      log.userName, 
      `"${log.action}"`, 
      `"${log.target}"`, 
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

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(search.toLowerCase()) ||
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.target.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <header className="flex flex-col gap-2 text-left">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <History className="text-accent" /> {t.nav.log_aktivitas}
        </h1>
        <p className="text-muted-foreground">Monitor riwayat perubahan dan aktivitas sistem secara transparan.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
         <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Cari berdasarkan pengguna, aksi, atau target..." 
              className="w-full bg-muted border-none rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
         </div>
         <div className="relative">
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
              <div className="absolute top-full right-0 mt-2 w-full glass-card !bg-background/95 backdrop-blur-xl border border-border/50 p-2 z-50 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
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

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="premium-table w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-muted/40 font-bold uppercase tracking-widest text-[10px] text-muted-foreground/80">
                <th className="p-4 px-6">Timestamp</th>
                <th className="p-4">Pengguna</th>
                <th className="p-4">Aktivitas</th>
                <th className="p-4">Objek/Target</th>
                <th className="p-4 text-center">Tipe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {isLoading ? (
                <tr><td colSpan={5} className="p-20 text-center text-muted-foreground animate-pulse italic">Memperbarui data audit...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-muted-foreground italic">Belum ada aktivitas yang tercatat.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/[0.02] transition-colors group">
                    <td className="p-4 px-6 text-xs text-muted-foreground flex flex-col">
                      <span className="flex items-center gap-1.5 font-mono"><Clock size={10} /> {new Date(log.createdAt).toLocaleTimeString()}</span>
                      <span className="flex items-center gap-1.5 mt-0.5 opacity-60"><Calendar size={10} /> {new Date(log.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="p-4 text-sm font-bold">{log.userName}</td>
                    <td className="p-4 text-sm font-medium">{log.action}</td>
                    <td className="p-4 text-xs font-medium text-accent">{log.target}</td>
                    <td className="p-4 text-center">
                      <span className={`badge uppercase text-[8px] tracking-tighter !px-1.5 ${
                        log.type === 'danger' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                        log.type === 'admin' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        log.type === 'system' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-6 md:p-8 flex items-center justify-between bg-muted/10 border-t border-border/5">
          <div className="text-muted-foreground italic text-[10px] uppercase tracking-widest font-bold opacity-60">
            {isLoading ? "REFRESHING..." : `TOTAL: ${logs.length} ENTRIES`}
          </div>
          <button 
            onClick={fetchLogs}
            className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
          >
            Refresh Logs
          </button>
        </div>
      </div>
    </div>
  );
}
