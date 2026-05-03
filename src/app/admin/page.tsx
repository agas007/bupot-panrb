"use client";

import { useState } from "react";
import { 
  Upload, CheckCircle, AlertCircle, Loader2, 
  X, Eye, Trash2, 
  History, Hammer
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface PreviewRow {
  spmNumber: string;
  recipient: string;
  deductionAmount: number;
  sp2dNumber?: string;
  description?: string;
}

export default function AdminPage() {
  const { language, t } = useLanguage();
  const [potonganFile, setPotonganFile] = useState<File | null>(null);
  const [sppFile, setSppFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // 🔥 NEW: Preview states
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 🔥 NEW: Log Retention states
  const [retentionDays, setRetentionDays] = useState(30);
  const [isCleaning, setIsCleaning] = useState(false);

  const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : "Unknown error");

  const handleProcessPreview = async () => {
    if (!potonganFile || !sppFile) return;
    setIsProcessing(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("potongan", potonganFile);
    formData.append("spp", sppFile);

    try {
      const simulatedUser = localStorage.getItem("sim_user");
      const res = await fetch("/api/import?preview=true", {
        method: "POST",
        headers: {
          "x-simulated-username": simulatedUser ? JSON.parse(simulatedUser).username : "admin"
        },
        body: formData,
      });

      const data: { preview?: PreviewRow[]; count?: number; error?: string } = await res.json();
      if (res.ok) {
        setPreviewData(data.preview ?? []);
        setPreviewCount(data.count ?? 0);
        setShowPreviewModal(true);
      } else {
        throw new Error(data.error ?? "Failed to load preview data.");
      }
    } catch (err: unknown) {
      setStatus({ type: "error", message: getErrorMessage(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    setIsProcessing(true);
    setShowPreviewModal(false);
    setStatus(null);

    const formData = new FormData();
    formData.append("potongan", potonganFile!);
    formData.append("spp", sppFile!);

    try {
      const simulatedUser = localStorage.getItem("sim_user");
      const res = await fetch("/api/import", {
        method: "POST",
        headers: {
          "x-simulated-user": simulatedUser ? JSON.parse(simulatedUser).name : "Admin (Simulated)",
          "x-simulated-username": simulatedUser ? JSON.parse(simulatedUser).username : "admin"
        },
        body: formData,
      });

      const data: { count?: number; error?: string } = await res.json();
      if (res.ok) {
        setStatus({
          type: "success",
          message: language === "ID" 
            ? `Berhasil mengimpor ${data.count ?? 0} data ke sistem.` 
            : `Successfully imported ${data.count ?? 0} records.`,
        });
        setPotonganFile(null);
        setSppFile(null);
      } else {
        throw new Error(data.error ?? "Failed to import data.");
      }
    } catch (err: unknown) {
      setStatus({ type: "error", message: getErrorMessage(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanupLogs = async () => {
    if (!confirm(language === "ID" ? `Hapus semua log aktivitas yang lebih lama dari ${retentionDays} hari?` : `Delete all logs older than ${retentionDays} days?`)) return;
    setIsCleaning(true);
    try {
      const simulatedUser = localStorage.getItem("sim_user");
      const res = await fetch("/api/admin/system/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-simulated-username": simulatedUser ? JSON.parse(simulatedUser).username : "admin"
        },
        body: JSON.stringify({ days: retentionDays }),
      });
      const data: { message?: string; error?: string } = await res.json();
      if (res.ok) {
        alert(data.message ?? "Cleanup completed.");
      } else {
        throw new Error(data.error ?? "Failed to cleanup logs.");
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2 text-left">
        <h1 className="text-3xl font-black tracking-tight">{t.admin.title}</h1>
        <p className="text-muted-foreground">{t.admin.subtitle}</p>
      </header>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-background/70 backdrop-blur-md z-1000 flex items-center justify-center p-4">
           <div className="glass-card w-full max-w-6xl p-8 flex flex-col gap-8 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] border-border/70 bg-card/95 text-card-foreground">
              <div className="flex justify-between items-center text-left">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-accent/20 text-accent rounded-2xl"><Eye size={32} /></div>
                    <div className="flex flex-col">
                       <h2 className="text-2xl font-black uppercase tracking-tight">{language === "ID" ? "Pratinjau Data" : "Data Preview"}</h2>
                       <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{language === "ID" ? `Menemukan ${previewCount} baris data dari penggabungan file.` : `Discovered ${previewCount} rows after merging files.`}</p>
                    </div>
                 </div>
                 <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-muted rounded-full transition-all text-muted-foreground hover:text-foreground"><X size={24}/></button>
              </div>

              <div className="flex-1 overflow-auto border border-border/70 rounded-3xl bg-background/80 shadow-inner">
                 <table className="admin-preview-table w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur-md">
                       <tr className="uppercase font-black tracking-widest text-[10px] text-muted-foreground border-b border-border/70">
                          <th className="p-4 px-6">SPM NUMBER</th>
                          <th className="p-4">RECIPIENT</th>
                          <th className="p-4">DEDUCTION (IDR)</th>
                          <th className="p-4">SP2D REF</th>
                          <th className="p-4">DESCRIPTION</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                       {previewData.map((row, i) => (
                         <tr key={i} className="hover:bg-accent/5 transition-colors even:bg-muted/20">
                            <td className="p-4 px-6 font-semibold text-foreground">{row.spmNumber}</td>
                            <td className="p-4 font-medium text-foreground/90">{row.recipient}</td>
                            <td className="p-4 font-black tabular-nums text-accent">{row.deductionAmount.toLocaleString("id-ID")}</td>
                            <td className="p-4 font-mono text-muted-foreground">{row.sp2dNumber || "-"}</td>
                            <td className="p-4 italic text-muted-foreground max-w-[200px] truncate">{row.description || "-"}</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
                 {previewCount > 100 && (
                   <div className="p-4 text-center bg-accent/5 italic text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                      ---Showing 100 of {previewCount} items---
                   </div>
                 )}
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setShowPreviewModal(false)} className="flex-1 bg-muted/50 hover:bg-muted text-foreground py-4 rounded-2xl font-black uppercase text-xs transition-all tracking-widest outline-none">Cancel</button>
                 <button onClick={handleConfirmImport} className="flex-2 premium-button py-4 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3">
                    <CheckCircle size={18} /> {language === "ID" ? `Ya, Impor ${previewCount} Data` : `Yes, Import ${previewCount} Items`}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Import Section */}
      <section className="glass-card p-10 flex flex-col gap-8 shadow-xl border-white/5">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-accent/10 text-accent rounded-3xl">
            <Upload size={32} />
          </div>
          <div className="flex flex-col text-left">
            <h2 className="text-2xl font-black uppercase tracking-tight">{t.admin.import_title}</h2>
            <p className="text-sm text-muted-foreground font-medium">{t.admin.import_hint}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">1. {t.admin.file_potongan}</label>
            <div className={`border-3 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-4 transition-all duration-500 group cursor-pointer ${potonganFile ? "border-accent bg-accent/5 scale-[1.02] shadow-2xl shadow-accent/5" : "border-border hover:border-accent hover:bg-black/5 dark:hover:bg-white/5"}`} onClick={() => document.getElementById('potongan-upload')?.click()}>
              <div className={`p-4 rounded-2xl transition-all ${potonganFile ? "bg-accent text-white scale-110 shadow-lg" : "bg-muted text-muted-foreground group-hover:scale-110 group-hover:bg-accent/20 group-hover:text-accent"}`}><Upload size={32} /></div>
              <input type="file" className="hidden" id="potongan-upload" accept=".xlsx,.csv" onChange={(e) => setPotonganFile(e.target.files?.[0] || null)} />
              <div className="flex flex-col items-center text-center gap-1">
                <span className="font-black text-sm">{potonganFile ? potonganFile.name : t.admin.choose_file}</span>
                {!potonganFile && <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-40">Excel or CSV Only</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">2. {t.admin.file_spp}</label>
            <div className={`border-3 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-4 transition-all duration-500 group cursor-pointer ${sppFile ? "border-accent bg-accent/5 scale-[1.02] shadow-2xl shadow-accent/5" : "border-border hover:border-accent hover:bg-black/5 dark:hover:bg-white/5"}`} onClick={() => document.getElementById('spp-upload')?.click()}>
              <div className={`p-4 rounded-2xl transition-all ${sppFile ? "bg-accent text-white scale-110 shadow-lg" : "bg-muted text-muted-foreground group-hover:scale-110 group-hover:bg-accent/20 group-hover:text-accent"}`}><Upload size={32} /></div>
              <input type="file" className="hidden" id="spp-upload" accept=".xlsx,.csv" onChange={(e) => setSppFile(e.target.files?.[0] || null)} />
              <div className="flex flex-col items-center text-center gap-1">
                <span className="font-black text-sm">{sppFile ? sppFile.name : t.admin.choose_file}</span>
                {!sppFile && <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-40">Excel or CSV Only</span>}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleProcessPreview}
          disabled={!potonganFile || !sppFile || isProcessing}
          className="premium-button flex items-center justify-center gap-4 mt-4 disabled:opacity-50 py-6 text-xl font-black uppercase tracking-[0.2em] group shadow-2xl"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={28} /> : <Eye size={28} className="group-hover:scale-110 transition-transform" />}
          {isProcessing ? (language === "ID" ? "Menganalisis..." : "Analyzing...") : (language === "ID" ? "Pratinjau & Analisis" : "Preview & Analyze")}
        </button>

        {status && (
          <div className={`p-6 rounded-3xl flex items-start gap-5 animate-in slide-in-from-bottom-6 transition-all ${status.type === "success" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-lg shadow-emerald-500/5" : "bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-lg shadow-rose-500/5"}`}>
            {status.type === "success" ? <CheckCircle size={28} className="shrink-0 mt-0.5" /> : <AlertCircle size={28} className="shrink-0 mt-0.5" />}
            <div className="flex flex-col text-left">
              <span className="font-black text-lg uppercase tracking-tight leading-none mb-1">{status.type === "success" ? (language === "ID" ? "Berhasil!" : "Success!") : (language === "ID" ? "Gagal!" : "Error!")}</span>
              <span className="text-sm font-bold opacity-80">{status.message}</span>
            </div>
          </div>
        )}
      </section>

      {/* 🔥 NEW: Maintenance & Log Retention Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="md:col-span-2 glass-card p-8 border-rose-500/10 flex flex-col gap-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700"><Trash2 size={120} /></div>
            <div className="flex items-center gap-4">
               <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl"><History size={24} /></div>
               <div className="flex flex-col text-left">
                  <h3 className="font-black uppercase tracking-widest text-sm">{language === "ID" ? "Pembersihan Audit Log" : "Audit Log Retention"}</h3>
                  <p className="text-[11px] text-muted-foreground font-medium">{language === "ID" ? "Hapus riwayat aktivitas lama untuk menjaga performa database." : "Purge old activity logs to maintain database performance optimally."}</p>
               </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-2 relative z-10">
               <div className="flex flex-col gap-2 flex-1 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rentang Waktu (Hari)</label>
                  <div className="flex items-center gap-3">
                     <input type="range" min="1" max="90" step="1" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))} className="flex-1 accent-rose-500 cursor-pointer h-2 bg-muted rounded-full" />
                     <div className="bg-rose-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-lg shadow-rose-500/20">{retentionDays} {language === "ID" ? "Hari" : "Days"}</div>
                  </div>
               </div>
               <button onClick={handleCleanupLogs} disabled={isCleaning} className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-rose-500/20 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50">
                  {isCleaning ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  {language === "ID" ? "Hapus Sekarang" : "Purge Now"}
               </button>
            </div>
         </div>

         <div className="glass-card p-8 border-accent/10 flex flex-col gap-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-all duration-500"><Hammer size={80} /></div>
            <div className="flex items-center gap-4">
               <div className="p-3 bg-accent/10 text-accent rounded-2xl"><Activity size={24} className="" /></div>
               <div className="flex flex-col text-left">
                  <h3 className="font-black uppercase tracking-widest text-sm">System Health</h3>
                  <p className="text-[11px] text-muted-foreground font-medium">Database Status & Maintenance.</p>
               </div>
            </div>
            <div className="flex flex-col gap-3 mt-auto">
               <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5"><span className="text-[11px] font-bold opacity-60">PRISMA CLIENT</span><span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">Connected</span></div>
               <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5"><span className="text-[11px] font-bold opacity-60">LOGGING SYSTEM</span><span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">Active</span></div>
            </div>
         </div>
      </section>
    </div>
  );
}

function Activity({ size, className }: { size: number, className: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  );
}
