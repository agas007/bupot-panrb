"use client";

import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function AdminPage() {
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
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({
          type: "success",
          message: `Successfully imported ${data.count} records.`,
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
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin Control Panel</h1>
        <p className="text-muted-foreground">Manage data imports and user assignments.</p>
      </header>

      <section className="glass-card p-8 flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Data Import Center</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              1. Monitoring Potongan SPM
            </label>
            <div 
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors ${
                potonganFile ? "border-accent bg-accent/5" : "border-border hover:border-accent"
              }`}
            >
              <Upload className={potonganFile ? "text-accent" : "text-muted-foreground"} size={32} />
              <input
                type="file"
                className="hidden"
                id="potongan-upload"
                onChange={(e) => setPotonganFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="potongan-upload" className="cursor-pointer text-center">
                <span className="font-medium text-sm">
                  {potonganFile ? potonganFile.name : "Choose File or Drag here"}
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              2. Monitoring SPP, SPM, SP2D
            </label>
            <div 
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors ${
                sppFile ? "border-accent bg-accent/5" : "border-border hover:border-accent"
              }`}
            >
              <Upload className={sppFile ? "text-accent" : "text-muted-foreground"} size={32} />
              <input
                type="file"
                className="hidden"
                id="spp-upload"
                onChange={(e) => setSppFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="spp-upload" className="cursor-pointer text-center">
                <span className="font-medium text-sm">
                  {sppFile ? sppFile.name : "Choose File or Drag here"}
                </span>
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!potonganFile || !sppFile || isUploading}
          className="premium-button flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
          {isUploading ? "Processing..." : "Merge & Import Data"}
        </button>

        {status && (
          <div className={`p-4 rounded-xl flex items-center gap-3 ${
            status.type === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
          }`}>
            {status.type === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span className="font-medium text-sm">{status.message}</span>
          </div>
        )}
      </section>
    </div>
  );
}
