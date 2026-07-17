"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Save, Search } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { PPH21_TAX_OBJECT_LABELS, PPH21_TAX_OBJECTS } from "@/lib/pph21";
import { RecipientCardSkeletons } from "@/components/TableSkeleton";

type Code = keyof typeof PPH21_TAX_OBJECTS;
type Recipient = {
  id: number;
  nik: string;
  name: string;
  defaultTaxObjectCode: Code;
};

const codes = Object.keys(PPH21_TAX_OBJECTS) as Code[];
const isPlaceholderRecipientName = (name: string) => /^NIK\s+\d+$/i.test(name.trim());

function MasterPenerimaPph21Content() {
  const { language } = useLanguage();
  const isID = language === "ID";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, getAuthHeaders, isLoading: authLoading } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [search, setSearch] = useState("");
  const [recipientTaxObjectFilter, setRecipientTaxObjectFilter] = useState<"all" | Code>("all");
  const [recipientNameFilter, setRecipientNameFilter] = useState<"all" | "placeholder" | "named">("all");
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingRecipientId, setSavingRecipientId] = useState<number | null>(null);

  const recordId = searchParams.get("recordId");

  const loadRecipients = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/pph21/recipients", { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Gagal memuat master pegawai");
      setRecipients(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders, user]);

  useEffect(() => {
    if (!authLoading && user) void loadRecipients().catch((error) => setFeedback({ type: "error", message: error.message }));
  }, [authLoading, loadRecipients, user]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!recordId) return;
    router.replace(`/pph21?recordId=${encodeURIComponent(recordId)}`);
  }, [recordId, router]);

  async function updateRecipient(recipientId: number, payload: Partial<Pick<Recipient, "name" | "nik" | "defaultTaxObjectCode">>, options?: { silent?: boolean }) {
    const current = recipients.find((item) => item.id === recipientId);
    if (!current) return;
    const savingId = current.id;
    setSavingRecipientId(savingId);
    try {
      const res = await fetch("/api/pph21/recipients", {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id: recipientId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Gagal menyimpan master pegawai" });
        return;
      }
      await loadRecipients();
      if (!options?.silent) {
        setFeedback({ type: "success", message: "Master pegawai diperbarui." });
      }
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Gagal menyimpan master pegawai" });
    } finally {
      setSavingRecipientId((currentId) => (currentId === savingId ? null : currentId));
    }
  }

  const visibleRecipients = useMemo(
    () => recipients.filter((recipient) => {
      const matchesSearch = `${recipient.name} ${recipient.nik}`.toLowerCase().includes(search.toLowerCase());
      const matchesTaxObject = recipientTaxObjectFilter === "all" || recipient.defaultTaxObjectCode === recipientTaxObjectFilter;
      const matchesNameState =
        recipientNameFilter === "all"
          ? true
          : recipientNameFilter === "placeholder"
            ? isPlaceholderRecipientName(recipient.name)
            : !isPlaceholderRecipientName(recipient.name);
      return matchesSearch && matchesTaxObject && matchesNameState;
    }),
    [recipientNameFilter, recipientTaxObjectFilter, recipients, search],
  );

  if (recordId) {
    return (
      <div className="flex flex-col gap-4">
        <div className="glass-card p-6">
          <h1 className="text-2xl font-black">{isID ? "Mengalihkan ke workspace PPh 21" : "Redirecting to the PPh 21 workspace"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isID
              ? "Rincian SP2D dan XML dikelola di workspace PPh 21."
              : "SP2D details and XML handling live in the PPh 21 workspace."}
          </p>
          <Link href={`/pph21?recordId=${encodeURIComponent(recordId)}`} className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">
            {isID ? "Buka workspace" : "Open workspace"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10 text-left">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-black">{isID ? "Master Pegawai PPh 21" : "PPh 21 Employee Master"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isID
              ? "Kelola nama, NIK, dan default objek pajak pegawai. Detail SP2D, XML, dan pengisian recipient ada di workspace PPh 21."
              : "Manage employee names, NIK, and default tax objects. SP2D, XML, and recipient details live in the PPh 21 workspace."}
          </p>
        </div>
        <Link href="/pph21" className="inline-flex items-center justify-center rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-bold text-accent">
          {isID ? "Buka workspace PPh 21" : "Open PPh 21 workspace"}
        </Link>
      </header>

      {feedback && (
        <div className={`fixed bottom-6 right-6 z-[1100] max-w-md rounded-2xl border p-4 shadow-2xl backdrop-blur-sm flex items-start gap-3 ${feedback.type === "error" ? "bg-rose-500/15 border-rose-500/30 text-rose-500" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"}`}>
          {feedback.type === "error" ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <div className="text-sm font-medium leading-relaxed">{feedback.message}</div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isID ? "Cari nama atau NIK" : "Search by name or NIK"}
            className="bg-muted rounded-xl pl-10 pr-4 py-2.5 outline-none min-w-[280px]"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={recipientNameFilter}
            onChange={(e) => setRecipientNameFilter(e.target.value as "all" | "placeholder" | "named")}
            className="bg-muted rounded-xl px-4 py-2.5 outline-none text-sm min-w-[180px]"
          >
            <option value="all">{isID ? "Semua nama" : "All names"}</option>
            <option value="placeholder">{isID ? "Nama masih NIK" : "Still using NIK"}</option>
            <option value="named">{isID ? "Sudah direname" : "Renamed"}</option>
          </select>
          <select
            value={recipientTaxObjectFilter}
            onChange={(e) => setRecipientTaxObjectFilter(e.target.value as "all" | Code)}
            title={isID ? "Filter kode objek pajak" : "Filter tax object code"}
            className="bg-muted rounded-xl px-4 py-2.5 outline-none text-sm min-w-[180px] max-w-[240px] truncate"
          >
            <option value="all">{isID ? "Semua kode" : "All codes"}</option>
            {codes.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <RecipientCardSkeletons />
      ) : (
        <div className="grid gap-4">
          {visibleRecipients.map((recipient) => {
            const isPlaceholder = isPlaceholderRecipientName(recipient.name);
            return (
              <section key={recipient.id} className="glass-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          disabled={!isAdmin || savingRecipientId === recipient.id}
                          value={recipient.name}
                          onChange={(e) => setRecipients((items) => items.map((item) => item.id === recipient.id ? { ...item, name: e.target.value } : item))}
                          onBlur={() => {
                            if (isAdmin) void updateRecipient(recipient.id, { name: recipient.name }, { silent: true });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          className="min-w-0 flex-1 font-black text-lg bg-transparent border-b border-transparent focus:border-accent outline-none disabled:opacity-100"
                        />
                        {isPlaceholder && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-600 shrink-0">
                            {isID ? "Perlu rename" : "Needs rename"}
                          </span>
                        )}
                        {savingRecipientId === recipient.id && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                            <Loader2 size={12} className="animate-spin" /> {isID ? "Menyimpan" : "Saving"}
                          </span>
                        )}
                      </div>
                      <div className="grid gap-1 max-w-[280px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">NIK</span>
                        <input
                          disabled={!isAdmin || savingRecipientId === recipient.id}
                          value={recipient.nik}
                          onChange={(e) => setRecipients((items) => items.map((item) => item.id === recipient.id ? { ...item, nik: e.target.value.replace(/\D/g, "") } : item))}
                          onBlur={() => {
                            if (isAdmin) void updateRecipient(recipient.id, { nik: recipient.nik }, { silent: true });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          inputMode="numeric"
                          maxLength={16}
                          placeholder="16 digit NIK"
                          className="w-full font-mono text-sm bg-muted rounded-xl px-3 py-2 outline-none border border-transparent focus:border-accent disabled:opacity-100"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center shrink-0">
                    <select
                      disabled={!isAdmin}
                      value={recipient.defaultTaxObjectCode}
                      onChange={(e) => setRecipients((items) => items.map((item) => item.id === recipient.id ? { ...item, defaultTaxObjectCode: e.target.value as Code } : item))}
                      title={PPH21_TAX_OBJECT_LABELS[recipient.defaultTaxObjectCode]}
                      className="bg-muted rounded-xl p-2 text-sm disabled:opacity-70 max-w-[360px] truncate"
                    >
                      {codes.map((code) => <option key={code} value={code}>{code}</option>)}
                    </select>
                    {isAdmin && (
                      <button
                        onClick={() => void updateRecipient(recipient.id, { defaultTaxObjectCode: recipient.defaultTaxObjectCode })}
                        className="p-2 text-accent"
                        title={isID ? "Simpan perubahan" : "Save changes"}
                      >
                        <Save size={17} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  {isID ? "Buka workspace PPh 21 untuk mengisi withholding, XML, dan PTKP." : "Open the PPh 21 workspace for withholding, XML, and PTKP."}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MasterPenerimaPph21Page() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-muted-foreground">Memuat master penerima PPh 21...</div>}>
      <MasterPenerimaPph21Content />
    </Suspense>
  );
}
