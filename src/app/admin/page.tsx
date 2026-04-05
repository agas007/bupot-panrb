"use client";

import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function AdminPage() {
  const { language, t } = useLanguage();
  const [potonganFile, setPotonganFile] = useState<File | null>(null);
  const [sppFile, setSppFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleUpload = async () => {
    if (!potonganFile || !sppFile) return;

    setIsUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("potongan", potonganFile);
    formData.append("spp", sppFile);

    try {
      const simulatedUser = localStorage.getItem("sim_user");
      const userName = simulatedUser ? JSON.parse(simulatedUser).name : "Admin (Simulated)";

      const res = await fetch("/api/import", {
        method: "POST",
        headers: {
          "x-simulated-user": userName
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({
          type: "success",
          message: language === "ID" 
            ? `Berhasil mengimpor ${data.count} data.` 
            : `Successfully imported ${data.count} records.`,
        });
        setPotonganFile(null);
        setSppFile(null);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-left">
        <h1 className="text-3xl font-bold tracking-tight">{t.admin.title}</h1>
        <p className="text-muted-foreground">{t.admin.subtitle}</p>
      </header>

      <section className="glass-card p-10 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 text-accent rounded-2xl">
            <Upload size={32} />
          </div>
          <div className="flex flex-col text-left">
            <h2 className="text-2xl font-bold">{t.admin.import_title}</h2>
            <p className="text-sm text-muted-foreground">{t.admin.import_hint}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
              1. {t.admin.file_potongan}
            </label>
            <div 
              className={`border-3 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 transition-all duration-300 group cursor-pointer ${
                potonganFile 
                ? "border-accent bg-accent/5 scale-[1.02] shadow-xl shadow-accent/5" 
                : "border-border hover:border-accent hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              onClick={() => document.getElementById('potongan-upload')?.click()}
            >
              <div className={`p-4 rounded-2xl transition-all ${potonganFile ? "bg-accent text-white scale-110" : "bg-muted text-muted-foreground group-hover:scale-110 group-hover:bg-accent/20 group-hover:text-accent"}`}>
                <Upload size={32} />
              </div>
              <input
                type="file"
                className="hidden"
                id="potongan-upload"
                onChange={(e) => setPotonganFile(e.target.files?.[0] || null)}
              />
              <div className="flex flex-col items-center text-center gap-1">
                <span className="font-bold text-sm">
                  {potonganFile ? potonganFile.name : t.admin.choose_file}
                </span>
                {!potonganFile && <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter opacity-60">XLSX OR CSV ONLY</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
              2. {t.admin.file_spp}
            </label>
            <div 
              className={`border-3 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 transition-all duration-300 group cursor-pointer ${
                sppFile 
                ? "border-accent bg-accent/5 scale-[1.02] shadow-xl shadow-accent/5" 
                : "border-border hover:border-accent hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              onClick={() => document.getElementById('spp-upload')?.click()}
            >
              <div className={`p-4 rounded-2xl transition-all ${sppFile ? "bg-accent text-white scale-110" : "bg-muted text-muted-foreground group-hover:scale-110 group-hover:bg-accent/20 group-hover:text-accent"}`}>
                <Upload size={32} />
              </div>
              <input
                type="file"
                className="hidden"
                id="spp-upload"
                onChange={(e) => setSppFile(e.target.files?.[0] || null)}
              />
              <div className="flex flex-col items-center text-center gap-1">
                <span className="font-bold text-sm">
                  {sppFile ? sppFile.name : t.admin.choose_file}
                </span>
                {!sppFile && <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter opacity-60">XLSX OR CSV ONLY</span>}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!potonganFile || !sppFile || isUploading}
          className="premium-button flex items-center justify-center gap-3 mt-4 disabled:opacity-50 py-5 text-lg font-bold group"
        >
          {isUploading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} className="group-hover:scale-110 transition-transform" />}
          {isUploading ? (language === "ID" ? "Memproses..." : "Processing...") : t.admin.import_button}
        </button>

        {status && (
          <div className={`p-6 rounded-2xl flex items-start gap-4 animate-in slide-in-from-bottom-4 transition-all ${
            status.type === "success" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
          }`}>
            {status.type === "success" ? <CheckCircle size={24} className="shrink-0 mt-0.5" /> : <AlertCircle size={24} className="shrink-0 mt-0.5" />}
            <div className="flex flex-col text-left">
              <span className="font-bold text-base">{status.type === "success" ? (language === "ID" ? "Berhasil!" : "Success!") : (language === "ID" ? "Terjadi Kesalahan" : "An Error Occurred")}</span>
              <span className="text-sm font-medium opacity-90">{status.message}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
