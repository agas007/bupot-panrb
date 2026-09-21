"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Database, Loader2, Play, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type StorageStatus = "idle" | "loading" | "ok" | "error" | "not_configured";

export default function StoragePage() {
  const { user, getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<StorageStatus>("idle");
  const [message, setMessage] = useState("Belum ada pengujian.");
  const [isRunning, setIsRunning] = useState(false);

  const readStatus = useCallback(async () => {
    if (!user) return;
    setStatus("loading");
    try {
      const response = await fetch("/api/admin/storage", { headers: getAuthHeaders(), cache: "no-store" });
      const data = await response.json() as { status?: string; error?: string; upstreamStatus?: number };
      if (response.ok && data.status === "ok") {
        setStatus("ok");
        setMessage("Bucket dapat dijangkau dan credential diterima.");
      } else if (data.status === "not_configured") {
        setStatus("not_configured");
        setMessage("Konfigurasi MinIO belum lengkap di environment server.");
      } else {
        setStatus("error");
        setMessage(data.error ?? `MinIO tidak tersedia${data.upstreamStatus ? ` (HTTP ${data.upstreamStatus})` : ""}.`);
      }
    } catch {
      setStatus("error");
      setMessage("Tidak bisa memanggil endpoint storage.");
    }
  }, [getAuthHeaders, user]);

  useEffect(() => {
    void readStatus();
  }, [readStatus]);

  const runSmokeTest = async () => {
    setIsRunning(true);
    setStatus("loading");
    setMessage("Mengunggah, mengunduh, lalu menghapus object dummy...");
    try {
      const response = await fetch("/api/admin/storage", { method: "POST", headers: getAuthHeaders() });
      const data = await response.json() as { error?: string; objectKey?: string };
      if (!response.ok) throw new Error(data.error ?? "Smoke test gagal.");
      setStatus("ok");
      setMessage(`Smoke test berhasil. Object sementara dihapus: ${data.objectKey}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Smoke test gagal.");
    } finally {
      setIsRunning(false);
    }
  };

  if (!user || user.role !== "ADMIN") return null;

  const StatusIcon = status === "ok" ? CheckCircle2 : status === "error" || status === "not_configured" ? XCircle : Database;
  const statusClass = status === "ok" ? "text-emerald-500" : status === "error" || status === "not_configured" ? "text-rose-500" : "text-accent";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-10">
      <header>
        <div className="mb-3 flex items-center gap-3 text-accent">
          <Database size={22} />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Admin Storage</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Storage MinIO</h1>
        <p className="mt-2 text-muted-foreground">Uji koneksi bucket dan alur object storage tanpa menyentuh dokumen archive.</p>
      </header>

      <section className="glass-card flex flex-col gap-6 p-8">
        <div className="flex items-start gap-4">
          <StatusIcon className={statusClass} size={28} />
          <div>
            <h2 className="text-lg font-bold">Status koneksi</h2>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80" onClick={() => void readStatus()} disabled={status === "loading"}>
            Refresh status
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50" onClick={() => void runSmokeTest()} disabled={isRunning}>
            {isRunning ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            Test upload-download-delete
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-sm text-muted-foreground">
        Smoke test hanya memakai object text sementara di prefix <code className="text-foreground">__healthcheck/</code> dan menghapusnya setelah download berhasil. Credential tidak pernah dikirim ke browser.
      </section>
    </div>
  );
}
