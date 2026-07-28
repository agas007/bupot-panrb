"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Archive, CheckCircle, Clock3, Download, FileText, FolderOpen, FolderTree, Paperclip, Plus, ShieldCheck, Upload, X, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type ArchiveStatus = "ARCHIVED" | "PENDING_APPROVAL" | "REJECTED" | "DISPOSED";
type DataType = "SPM_RECORD" | "PPH21_WITHHOLDING" | "TAX_RECONCILIATION";

interface DynamicArchiveRecord {
  id: number;
  uniqueKey: string;
  spmNumber: string;
  spmDate: string;
  accountCode: string;
  deductionAmount: number;
  sp2dNumber: string | null;
  recipient: string | null;
  description: string | null;
  status: string;
  importDate: string;
  updatedAt: string;
  archiveStatus: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  retentionProgress: {
    current: number;
    total: number;
    percentage: number;
    statusLabel: string;
  };
}

interface ArchiveRecord {
  id: number;
  originalId: number;
  dataType: DataType | string;
  archiveStatus: ArchiveStatus | string;
  spmNumber: string | null;
  archivedData: Record<string, unknown> | null;
  archivedBy: {
    id: number;
    name: string;
    username: string;
  } | null;
  disposalScheduledAt: string | null;
  disposalScheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ArchiveStatsResponse {
  stats: Record<string, number>;
  byDataType: Record<string, number>;
  disposalPending: number;
  total: number;
}

interface DynamicArchiveStatsResponse {
  data: DynamicArchiveRecord[];
  summary: Record<string, number>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface ArchiveSummaryResponse {
  period: string;
  status: string;
  reportType: string;
  retentionTimeline: Record<string, number>;
  byDataType: Record<string, number>;
  accessAudit: Array<{
    id: number;
    accessType: string;
    archivedRecord: {
      spmNumber: string | null;
      dataType: string;
      archiveStatus: string;
    };
    accessedBy: { id: number; name: string } | null;
    createdAt: string;
  }>;
  disposalQueue: {
    pending: number;
    approved: number;
  };
  summary: {
    totalArchivedRecords: number;
    totalAccessLogs: number;
  };
}

interface DisposalRequest {
  id: number;
  archivedRecordId: number;
  archivedRecord: {
    id: number;
    spmNumber?: string | null;
    dataType: string;
  };
  requestedBy: { name: string };
  approvedBy?: { name: string } | null;
  status: string;
  reason?: string | null;
  createdAt: string;
}

interface DossierAttachment {
  name: string;
  size: number;
  type: string;
}

interface DossierDraft {
  id: string;
  index: string;
  title: string;
  period: string;
  notes: string;
  files: DossierAttachment[];
  createdAt: string;
}

interface StoredArchiveAttachment {
  id: number;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: number; name: string; username: string } | null;
}

interface StoredArchiveDossier {
  id: number;
  dossierIndex: string;
  title: string;
  period: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string; username: string } | null;
  attachments: StoredArchiveAttachment[];
}

type DossierSource =
  | { kind: "archive"; record: ArchiveRecord }
  | { kind: "dynamic"; record: DynamicArchiveRecord }
  | { kind: "stored"; record: StoredArchiveDossier };

const DATA_TYPE_LABELS: Record<string, string> = {
  SPM_RECORD: "SPM Record",
  PPH21_WITHHOLDING: "PPh 21",
  TAX_RECONCILIATION: "Rekonsiliasi Pajak",
};

const STATUS_LABELS: Record<string, string> = {
  ARCHIVED: "Arsip permanen",
  PENDING_APPROVAL: "Menunggu approval",
  REJECTED: "Ditolak",
  DISPOSED: "Dimusnahkan",
};

const STATUS_STYLES: Record<string, string> = {
  ARCHIVED: "bg-emerald-100 text-emerald-800",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  REJECTED: "bg-rose-100 text-rose-800",
  DISPOSED: "bg-slate-200 text-slate-800",
};

const DATA_TYPE_STYLES: Record<string, string> = {
  SPM_RECORD: "bg-sky-100 text-sky-800",
  PPH21_WITHHOLDING: "bg-violet-100 text-violet-800",
  TAX_RECONCILIATION: "bg-cyan-100 text-cyan-800",
};

export default function ArchivePage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"dinamis" | "permanen" | "approval" | "ringkasan">("dinamis");
  const [stats, setStats] = useState<ArchiveStatsResponse | null>(null);
  const [dynamicRecords, setDynamicRecords] = useState<DynamicArchiveStatsResponse | null>(null);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [summary, setSummary] = useState<ArchiveSummaryResponse | null>(null);
  const [approvalQueue, setApprovalQueue] = useState<DisposalRequest[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedDataType, setSelectedDataType] = useState<string | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingApproval, setLoadingApproval] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const hasLoadedDynamicRecords = useRef(false);
  const [selectedDossier, setSelectedDossier] = useState<DossierSource | null>(null);
  const [selectedDossierTab, setSelectedDossierTab] = useState<"indeks" | "status" | "riwayat" | "lampiran">("indeks");
  const [draftIndex, setDraftIndex] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPeriod, setDraftPeriod] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [storedDossiers, setStoredDossiers] = useState<DossierDraft[]>([]);
  const [attachmentDrafts, setAttachmentDrafts] = useState<Record<string, DossierAttachment[]>>({});
  const [isStoringDossier, setIsStoringDossier] = useState(false);
  const [isAppendingAttachment, setIsAppendingAttachment] = useState(false);
  const [storageNotice, setStorageNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const canViewArchive = currentUser?.role === "ADMIN" || currentUser?.role === "ARCHIVIST";
  const canApproveDisposal = currentUser?.role === "ADMIN";

  useEffect(() => {
    if (!canViewArchive) return;

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/archive/stats");
        const data = (await res.json()) as ArchiveStatsResponse;
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch archive stats:", error);
      }
    };

    fetchStats();
  }, [canViewArchive]);

  useEffect(() => {
    if (!canViewArchive) return;

    const fetchRecords = async () => {
      setLoadingRecords(true);
      try {
        const params = new URLSearchParams();
        if (selectedStatus) params.set("status", selectedStatus);
        if (selectedDataType) params.set("dataType", selectedDataType);

        const res = await fetch(`/api/archive/records?${params.toString()}`);
        const data = await res.json();
        setRecords(data.data || []);
      } catch (error) {
        console.error("Failed to fetch archive records:", error);
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchRecords();
  }, [canViewArchive, selectedStatus, selectedDataType]);

  useEffect(() => {
    if (!canViewArchive) return;

    if (hasLoadedDynamicRecords.current) return;
    hasLoadedDynamicRecords.current = true;

    const fetchDynamicRecords = async () => {
      try {
        const res = await fetch("/api/archive/dynamic-records");
        const data = (await res.json()) as DynamicArchiveStatsResponse;
        setDynamicRecords(data);
      } catch (error) {
        console.error("Failed to fetch dynamic archive records:", error);
      }
    };

    fetchDynamicRecords();
  }, [activeTab, canViewArchive]);

  const refreshStoredDossiers = async () => {
    const res = await fetch("/api/archive/dossiers?limit=12");
    const data = await res.json();
    const dossiers: DossierDraft[] = (data.data || []).map((item: StoredArchiveDossier) => ({
      id: String(item.id),
      index: item.dossierIndex,
      title: item.title,
      period: item.period || "Belum diisi",
      notes: item.notes || "",
      files: (item.attachments || []).map((attachment) => ({
        name: attachment.fileName,
        size: attachment.size,
        type: attachment.mimeType,
      })),
      createdAt: item.createdAt,
    }));

    setStoredDossiers(dossiers);
    return dossiers;
  };

  useEffect(() => {
    if (!canViewArchive) return;

    void refreshStoredDossiers().catch((error) => {
      console.error("Failed to fetch stored archive dossiers:", error);
    });
  }, [canViewArchive]);

  useEffect(() => {
    if (!canViewArchive) return;

    if (activeTab !== "approval") return;

    const fetchApprovals = async () => {
      setLoadingApproval(true);
      try {
        const res = await fetch("/api/archive/disposal?status=PENDING");
        const data = await res.json();
        setApprovalQueue(data.data || []);
      } catch (error) {
        console.error("Failed to fetch approval queue:", error);
      } finally {
        setLoadingApproval(false);
      }
    };

    fetchApprovals();
  }, [activeTab, canViewArchive]);

  useEffect(() => {
    if (!canViewArchive) return;

    if (activeTab !== "ringkasan") return;

    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await fetch("/api/archive/compliance-report");
        const data = (await res.json()) as ArchiveSummaryResponse;
        setSummary(data);
      } catch (error) {
        console.error("Failed to fetch archive summary:", error);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [activeTab, canViewArchive]);

  const groupedRecords = useMemo(() => {
    return records.reduce<Record<string, ArchiveRecord[]>>((acc, record) => {
      const key = record.dataType || "UNKNOWN";
      if (!acc[key]) acc[key] = [];
      acc[key].push(record);
      return acc;
    }, {});
  }, [records]);

  const sortedDataTypes = useMemo(() => {
    return Object.keys(groupedRecords).sort((a, b) => {
      const aLabel = DATA_TYPE_LABELS[a] || a;
      const bLabel = DATA_TYPE_LABELS[b] || b;
      return aLabel.localeCompare(bLabel, "id-ID");
    });
  }, [groupedRecords]);

  const statusOptions = Object.keys(stats?.stats || {});
  const dataTypeOptions = Object.keys(stats?.byDataType || {});

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDataType = (value: string) => DATA_TYPE_LABELS[value] || value;

  const formatStatus = (value: string) => STATUS_LABELS[value] || value;

  const getStatusBadge = (value: string) => STATUS_STYLES[value] || "bg-gray-100 text-gray-800";

  const getDataTypeBadge = (value: string) => DATA_TYPE_STYLES[value] || "bg-gray-100 text-gray-800";
  const retentionTimeline = summary?.retentionTimeline ?? {};
  const byDataTypeSummary = summary?.byDataType ?? {};
  const accessAudit = summary?.accessAudit ?? [];
  const dynamicRecordItems = dynamicRecords?.data ?? [];
  const dynamicSummary = dynamicRecords?.summary ?? {};
  const selectedDossierKey = selectedDossier
    ? `${selectedDossier.kind}-${selectedDossier.record.id}`
    : null;

  const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "0 KB";
    const kb = value / 1024;
    if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  };

  const fileToAttachment = (file: File): DossierAttachment => ({
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  });

  const buildDossierIndex = (source: DossierSource) => {
    if (source.kind === "dynamic") {
      return source.record.spmNumber || source.record.uniqueKey || `DIN-${source.record.id}`;
    }

    if (source.kind === "stored") {
      return source.record.dossierIndex;
    }

    return source.record.spmNumber || `ARS-${source.record.originalId}`;
  };

  const buildDossierTitle = (source: DossierSource) => {
    if (source.kind === "dynamic") {
      return source.record.recipient || source.record.description || source.record.spmNumber || "Dosier belum diberi nama";
    }

    if (source.kind === "stored") {
      return source.record.title;
    }

    const archivedData = source.record.archivedData;
    const archivedTitle =
      archivedData && typeof archivedData === "object"
        ? (() => {
            const candidate = archivedData as Record<string, unknown>;
            const value = candidate.title || candidate.name || candidate.subject;
            return typeof value === "string" ? value : null;
          })()
        : null;

    return (
      source.record.spmNumber ||
      archivedTitle ||
      `Arsip #${source.record.originalId}`
    );
  };

  const buildDossierStatus = (source: DossierSource) => {
    if (source.kind === "dynamic") {
      return source.record.archiveStatus === "ACTIVE"
        ? "Masih dipakai"
        : source.record.archiveStatus === "INACTIVE"
          ? "Siap dipindahkan"
          : "Menuju arsip permanen";
    }

    if (source.kind === "stored") {
      return source.record.status;
    }

    return formatStatus(source.record.archiveStatus);
  };

  const getDossierNotes = (source: DossierSource) => {
    if (source.kind === "dynamic") {
      return [
        `${formatDataType("SPM_RECORD")} dari impor ${formatDate(source.record.importDate)}`,
        `Retensi: ${source.record.retentionProgress.statusLabel}`,
      ];
    }

    if (source.kind === "stored") {
      return [
        `Disimpan pada ${formatDate(source.record.createdAt)}`,
        source.record.createdBy?.name ? `Disimpan oleh ${source.record.createdBy.name}` : "Belum ada petugas yang tercatat",
      ];
    }

    return [
      `Diarsipkan pada ${formatDate(source.record.createdAt)}`,
      source.record.archivedBy?.name ? `Diarsipkan oleh ${source.record.archivedBy.name}` : "Belum ada petugas yang tercatat",
    ];
  };

  const getDossierHistory = (source: DossierSource) => {
    if (source.kind === "dynamic") {
      return [
        {
          title: "Masuk dari impor",
          detail: `Data masuk pada ${formatDate(source.record.importDate)}.`,
          time: source.record.importDate,
        },
        {
          title: "Perubahan terakhir",
          detail: `Diperbarui pada ${formatDate(source.record.updatedAt)}.`,
          time: source.record.updatedAt,
        },
        {
          title: "Retensi berjalan",
          detail: source.record.retentionProgress.statusLabel,
          time: source.record.updatedAt,
        },
      ];
    }

    if (source.kind === "stored") {
      return [
        {
          title: "Masuk ke storage permanen",
          detail: `Dicatat pada ${formatDate(source.record.createdAt)}.`,
          time: source.record.createdAt,
        },
        {
          title: "Status penyimpanan",
          detail: source.record.status,
          time: source.record.updatedAt,
        },
        {
          title: "Petugas",
          detail: source.record.createdBy?.name || "Belum tercatat",
          time: source.record.updatedAt,
        },
      ];
    }

    return [
      {
        title: "Masuk ke arsip",
        detail: `Dicatat pada ${formatDate(source.record.createdAt)}.`,
        time: source.record.createdAt,
      },
      {
        title: "Status terakhir",
        detail: formatStatus(source.record.archiveStatus),
        time: source.record.updatedAt,
      },
      {
        title: "Petugas",
        detail: source.record.archivedBy?.name || "Belum tercatat",
        time: source.record.updatedAt,
      },
    ];
  };

  const getSourceAttachments = (source: DossierSource) => {
    if (source.kind === "stored") {
      return source.record.attachments.map((attachment) => ({
        name: attachment.fileName,
        size: attachment.size,
        type: attachment.mimeType,
      }));
    }

    if (source.kind === "archive") {
      const attachments = source.record.archivedData as Record<string, unknown> | null;
      const rawAttachments = attachments?.attachments || attachments?.files || attachments?.lampiran || attachments?.documents;

      if (Array.isArray(rawAttachments)) {
        return rawAttachments
          .map((item, index) => {
            if (typeof item === "string") {
              return { name: item, size: 0, type: "application/pdf" } satisfies DossierAttachment;
            }
            if (item && typeof item === "object") {
              const candidate = item as Record<string, unknown>;
              return {
                name: String(candidate.name || candidate.fileName || candidate.title || `Lampiran ${index + 1}`),
                size: Number(candidate.size || 0),
                type: String(candidate.type || candidate.mimeType || "application/pdf"),
              } satisfies DossierAttachment;
            }
            return null;
          })
          .filter((item): item is DossierAttachment => Boolean(item));
      }
    }

    const fallbackLabel = source.kind === "dynamic"
      ? `PDF SPM ${source.record.spmNumber}`
      : `PDF arsip ${source.record.spmNumber || source.record.originalId}`;

    return [{ name: fallbackLabel, size: 0, type: "application/pdf" }];
  };

  const selectedDossierAttachments = selectedDossierKey ? attachmentDrafts[selectedDossierKey] ?? [] : [];

  const handleApproval = async (recordId: number, action: "approve" | "reject") => {
    try {
      await fetch("/api/archive/disposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archivedRecordId: recordId,
          action,
          reason: action === "approve" ? "Disetujui admin arsip" : "Ditolak admin arsip",
        }),
      });

      const res = await fetch("/api/archive/disposal?status=PENDING");
      const data = await res.json();
      setApprovalQueue(data.data || []);
    } catch (error) {
      console.error("Failed to process approval:", error);
    }
  };

  const openDossier = (source: DossierSource) => {
    setSelectedDossier(source);
    setSelectedDossierTab("indeks");
  };

  const handleDraftFilesChange = (files: FileList | null) => {
    setDraftFiles(files ? Array.from(files) : []);
  };

  const handleSaveDraft = async () => {
    if (!draftIndex.trim() || !draftTitle.trim() || draftFiles.length === 0) return;

    setIsStoringDossier(true);
    setStorageNotice(null);

    try {
      const formData = new FormData();
      formData.append("dossierIndex", draftIndex.trim());
      formData.append("title", draftTitle.trim());
      formData.append("period", draftPeriod.trim());
      formData.append("notes", draftNotes.trim());
      draftFiles.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/archive/dossiers", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan dosier ke storage permanen.");
      }

      const stored: DossierDraft = {
        id: String(data.id),
        index: data.dossierIndex,
        title: data.title,
        period: data.period || "Belum diisi",
        notes: data.notes || "",
        files: (data.attachments || []).map((attachment: { fileName: string; mimeType: string; size: number }) => ({
          name: attachment.fileName,
          size: attachment.size,
          type: attachment.mimeType,
        })),
        createdAt: data.createdAt,
      };

      setStoredDossiers((current) => [stored, ...current]);
      setDraftIndex("");
      setDraftTitle("");
      setDraftPeriod("");
      setDraftNotes("");
      setDraftFiles([]);
      setStorageNotice({
        type: "success",
        message: `Dosier ${stored.index} tersimpan ke storage permanen.`,
      });
    } catch (error) {
      setStorageNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Gagal menyimpan dosier.",
      });
    } finally {
      setIsStoringDossier(false);
    }
  };

  const handleAttachmentUpload = (files: FileList | null) => {
    if (!selectedDossier || !files) return;

    if (selectedDossier.kind === "stored") {
      void (async () => {
        setIsAppendingAttachment(true);
        setStorageNotice(null);

        try {
          const formData = new FormData();
          formData.append("dossierId", String(selectedDossier.record.id));
          Array.from(files).forEach((file) => formData.append("files", file));

          const res = await fetch("/api/archive/dossiers", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Gagal menambahkan lampiran ke storage permanen.");
          }

          const refreshed = await refreshStoredDossiers();
          const updated = refreshed.find((item) => item.id === String(selectedDossier.record.id));

          if (updated) {
            setSelectedDossier({
              kind: "stored",
              record: {
                ...selectedDossier.record,
                title: updated.title,
                period: updated.period || null,
                notes: updated.notes || null,
                attachments: updated.files.map((file, index) => ({
                  id: index + 1,
                  fileName: file.name,
                  mimeType: file.type,
                  size: file.size,
                  createdAt: updated.createdAt,
                  uploadedBy: null,
                })),
              },
            });
          }

          setStorageNotice({
            type: "success",
            message: `Lampiran baru tersimpan permanen di dosier ${selectedDossier.record.dossierIndex}.`,
          });
        } catch (error) {
          setStorageNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Gagal menambahkan lampiran.",
          });
        } finally {
          setIsAppendingAttachment(false);
        }
      })();
      return;
    }

    if (!selectedDossierKey) return;

    const incoming = Array.from(files).map(fileToAttachment);
    setAttachmentDrafts((current) => ({
      ...current,
      [selectedDossierKey]: [...(current[selectedDossierKey] ?? []), ...incoming],
    }));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Memuat akses arsip...
      </div>
    );
  }

  if (!canViewArchive) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6">
        <div className="max-w-xl rounded-3xl border border-border/70 bg-card/90 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
            Akses arsip belum tersedia
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Menu ini hanya untuk admin dan petugas arsip.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-8 text-foreground md:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.08),transparent_22%)]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-accent p-3 text-accent-foreground shadow-lg">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">
                Manajemen Arsip
              </h1>
              <p className="text-sm text-muted-foreground">
                Setiap arsip diperlakukan sebagai dosier: ada indeks, status, riwayat, dan lampiran.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Arsip dinamis
            </div>
            <div className="mt-2 text-3xl font-black text-foreground">
              {dynamicRecords?.pagination.total ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Arsip permanen
            </div>
            <div className="mt-2 text-3xl font-black text-foreground">
              {stats?.total ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Menunggu approval
            </div>
            <div className="mt-2 text-3xl font-black text-amber-600">
              {stats?.disposalPending ?? 0}
            </div>
          </div>
            <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Dosier tersimpan
              </div>
              <div className="mt-2 text-3xl font-black text-foreground">
              {storedDossiers.length}
              </div>
            </div>
          </div>

        <section className="mb-8 overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-sm">
          <div className="border-b border-border/70 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Mulai dosier arsip
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  Upload banyak lampiran sekaligus
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Satu arsip dibuat sebagai dosier. Isi indeksnya, lalu upload PDF atau scan
                  pendukung dalam satu paket. Kalau belum lengkap, simpan dulu sebagai paket awal.
                </p>
              </div>
              <div className="hidden rounded-2xl bg-sky-500/10 px-4 py-3 text-right md:block">
                <div className="text-[10px] font-black uppercase tracking-widest text-sky-500">
                  Batch upload
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  PDF utama + lampiran
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Indeks dosier
                  </span>
                  <input
                    value={draftIndex}
                    onChange={(event) => setDraftIndex(event.target.value)}
                    placeholder="SPM 001 / 2026 / Pajak"
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-foreground"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Judul dosier
                  </span>
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="SPM, SP2D, dan bukti potong"
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-foreground"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Periode / tahun
                  </span>
                  <input
                    value={draftPeriod}
                    onChange={(event) => setDraftPeriod(event.target.value)}
                    placeholder="2026"
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-foreground"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Catatan singkat
                  </span>
                  <input
                    value={draftNotes}
                    onChange={(event) => setDraftNotes(event.target.value)}
                    placeholder="Misal: paket pajak Januari"
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-foreground"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Upload lampiran PDF sekaligus
                </span>
                <div className="rounded-3xl border-2 border-dashed border-border/70 bg-muted/20 p-6 transition hover:border-foreground/40">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(event) => handleDraftFilesChange(event.target.files)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-semibold file:text-background hover:file:bg-foreground/90"
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Bisa pilih banyak file sekaligus. Idealnya PDF SPM, PDF SP2D, bukti potong, dan lampiran pendukung lain.
                  </p>
                </div>
              </label>

              {draftFiles.length > 0 && (
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    File yang dipilih
                  </div>
                  <div className="mt-3 space-y-2">
                    {draftFiles.map((file) => (
                      <div key={file.name} className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">{file.name}</div>
                          <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                        </div>
                        <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {file.type || "file"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={!draftIndex.trim() || !draftTitle.trim() || draftFiles.length === 0 || isStoringDossier}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {isStoringDossier ? "Menyimpan..." : "Simpan ke storage permanen"}
                </button>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-700 dark:text-sky-300">
                  <Paperclip className="h-4 w-4" />
                  Upload batch, bukan satu-satu
                </div>
              </div>

              {storageNotice && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    storageNotice.type === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {storageNotice.message}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black tracking-tight text-foreground">
                  Storage permanen dosier
                </h3>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {storedDossiers.length} dosier
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {storedDossiers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/80 p-5 text-sm text-muted-foreground">
                    Belum ada dosier tersimpan. Simpan satu paket arsip dulu supaya masuk ke storage permanen.
                  </div>
                ) : (
                  storedDossiers.map((draft) => (
                    <div key={draft.id} className="rounded-2xl border border-border/70 bg-background/90 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            {draft.index}
                          </div>
                          <div className="mt-1 font-semibold text-foreground">{draft.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {draft.period} · {draft.files.length} lampiran
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                          Tersimpan
                        </span>
                      </div>
                      {draft.notes && (
                        <p className="mt-3 text-sm text-muted-foreground">{draft.notes}</p>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          openDossier({
                            kind: "stored",
                            record: {
                              id: Number(draft.id),
                              dossierIndex: draft.index,
                              title: draft.title,
                              period: draft.period || null,
                              notes: draft.notes || null,
                              status: "STORED",
                              createdAt: draft.createdAt,
                              updatedAt: draft.createdAt,
                              createdBy: null,
                              attachments: draft.files.map((file, index) => ({
                                id: index + 1,
                                fileName: file.name,
                                mimeType: file.type,
                                size: file.size,
                                createdAt: draft.createdAt,
                                uploadedBy: null,
                              })),
                            },
                          })
                        }
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Buka dosier
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6 rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap border-b border-border/70">
            <button
              type="button"
              onClick={() => setActiveTab("dinamis")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold ${
                activeTab === "dinamis"
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderTree className="h-4 w-4" />
              Arsip Dinamis
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("permanen")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold ${
                activeTab === "permanen"
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Archive className="h-4 w-4" />
              Arsip Permanen
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("approval")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold ${
                activeTab === "approval"
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Approval Admin
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ringkasan")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold ${
                activeTab === "ringkasan"
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertCircle className="h-4 w-4" />
              Ringkasan Akses
            </button>
          </div>

          <div className="p-6">
            {activeTab === "dinamis" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Ini daftar dosier yang masih dipakai atau sudah masuk masa inaktif.
                  Kalau masa simpan menurut jadwal retensi sudah habis, barulah dipindahkan ke arsip permanen atau diproses sesuai keputusan JRA.
                </div>

                {dynamicRecords ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Aktif
                      </div>
                      <div className="mt-2 text-3xl font-black text-foreground">
                        {dynamicSummary.ACTIVE ?? 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Inaktif
                      </div>
                      <div className="mt-2 text-3xl font-black text-foreground">
                        {dynamicSummary.INACTIVE ?? 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Menjelang arsip permanen
                      </div>
                      <div className="mt-2 text-3xl font-black text-foreground">
                        {dynamicSummary.ARCHIVED ?? 0}
                      </div>
                    </div>
                  </div>
                ) : null}

                {dynamicRecordItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                    Belum ada data arsip dinamis yang cocok.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(["ACTIVE", "INACTIVE", "ARCHIVED"] as const).map((statusKey) => {
                      const items = dynamicRecordItems.filter((item) => item.archiveStatus === statusKey);
                      if (items.length === 0) return null;

                      return (
                        <section
                          key={statusKey}
                          className="overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-sm"
                        >
                          <div className="flex flex-col gap-3 border-b border-border/70 p-5 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(statusKey)}`}>
                                {statusKey === "ACTIVE" ? "Aktif" : statusKey === "INACTIVE" ? "Inaktif" : "Menuju arsip permanen"}
                              </div>
                              <h2 className="mt-2 text-xl font-black tracking-tight text-foreground">
                                {statusKey === "ACTIVE" ? "Masih digunakan" : statusKey === "INACTIVE" ? "Sedang menunggu pemindahan" : "Perlu ditinjau untuk penyusutan"}
                              </h2>
                              <p className="text-sm text-muted-foreground">
                                Daftar ini mengikuti konsep arsip dinamis di lingkungan pemerintah, bukan arsip permanen.
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-muted-foreground">
                              {items.length} data
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                                <tr>
                                  <th className="px-5 py-4">SPM</th>
                                  <th className="px-5 py-4">Nama / Penerima</th>
                                  <th className="px-5 py-4">Status</th>
                                  <th className="px-5 py-4">Retensi</th>
                                  <th className="px-5 py-4">Terakhir diubah</th>
                                  <th className="px-5 py-4">Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((record) => (
                                  <tr key={record.id} className="border-t border-border/60">
                                    <td className="px-5 py-4 align-top">
                                      <div className="font-semibold text-foreground">
                                        {record.spmNumber}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {record.accountCode}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 align-top">
                                      <div className="font-semibold text-foreground">
                                        {record.recipient || "-"}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {record.description || "-"}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 align-top">
                                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(record.archiveStatus)}`}>
                                        {record.archiveStatus === "ACTIVE" ? "Aktif" : record.archiveStatus === "INACTIVE" ? "Inaktif" : "Menuju arsip permanen"}
                                      </span>
                                    </td>
                                    <td className="px-5 py-4 align-top">
                                      <div className="text-sm font-semibold text-foreground">
                                        {record.retentionProgress.statusLabel}
                                      </div>
                                      <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-muted">
                                        <div
                                          className="h-full rounded-full bg-sky-500"
                                          style={{ width: `${record.retentionProgress.percentage}%` }}
                                        />
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 align-top text-muted-foreground">
                                      {formatDate(record.updatedAt)}
                                    </td>
                                    <td className="px-5 py-4 align-top">
                                      <button
                                        type="button"
                                        onClick={() => openDossier({ kind: "dynamic", record })}
                                        className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
                                      >
                                        <FolderOpen className="h-3.5 w-3.5" />
                                        Buka dosier
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "permanen" && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStatus(null)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      selectedStatus === null
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    Semua status
                  </button>
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatus(status)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        selectedStatus === status
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {formatStatus(status)}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDataType(null)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      selectedDataType === null
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    Semua tipe
                  </button>
                  {dataTypeOptions.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedDataType(type)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        selectedDataType === type
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {formatDataType(type)}
                    </button>
                  ))}
                </div>

                {loadingRecords ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                    Memuat arsip permanen...
                  </div>
                ) : sortedDataTypes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                    Belum ada arsip permanen yang cocok dengan filter ini.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sortedDataTypes.map((type) => {
                      const items = groupedRecords[type] || [];
                      const statusCounts = items.reduce<Record<string, number>>((acc, item) => {
                        acc[item.archiveStatus] = (acc[item.archiveStatus] || 0) + 1;
                        return acc;
                      }, {});

                      return (
                        <section
                          key={type}
                          className="overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-sm"
                        >
                          <div className="flex flex-col gap-4 border-b border-border/70 p-5 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${getDataTypeBadge(type)}`}>
                                  {formatDataType(type)}
                                </span>
                                <span className="text-sm font-semibold text-muted-foreground">
                                  {items.length} dosier
                                </span>
                              </div>
                              <h2 className="mt-2 text-xl font-black tracking-tight text-foreground">
                                Dosier arsip {formatDataType(type)}
                              </h2>
                              <p className="text-sm text-muted-foreground">
                                Data ini sudah masuk area arsip permanen dan siap diawasi sesuai jadwal retensi.
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {Object.entries(statusCounts).map(([status, count]) => (
                                <span
                                  key={status}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(status)}`}
                                >
                                  {formatStatus(status)}: {count}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                                <tr>
                                  <th className="px-5 py-4">Identitas</th>
                                  <th className="px-5 py-4">Status</th>
                                  <th className="px-5 py-4">Diarsipkan oleh</th>
                                  <th className="px-5 py-4">Tanggal arsip</th>
                                  <th className="px-5 py-4">Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((record) => (
                                  <tr key={record.id} className="border-t border-border/60">
                                    <td className="px-5 py-4 align-top">
                                      <div className="font-semibold text-foreground">
                                        {record.spmNumber || `#${record.originalId}`}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        Original ID: {record.originalId}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 align-top">
                                      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(record.archiveStatus)}`}>
                                        {formatStatus(record.archiveStatus)}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 align-top">
                                      <div className="font-semibold text-foreground">
                                        {record.archivedBy?.name || "-"}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {record.archivedBy?.username || "-"}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 align-top text-muted-foreground">
                                      {formatDate(record.createdAt)}
                                    </td>
                                    <td className="px-5 py-4 align-top">
                                      <button
                                        type="button"
                                        onClick={() => openDossier({ kind: "archive", record })}
                                        className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
                                      >
                                        <FolderOpen className="h-3.5 w-3.5" />
                                        Buka dosier
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "approval" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-foreground" />
                  Hanya admin yang bisa approve. Petugas arsip tetap bisa melihat antrian, tapi belum bisa mengeksekusi approval.
                </div>

                {loadingApproval ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                    Memuat approval queue...
                  </div>
                ) : approvalQueue.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                    Tidak ada request approval yang pending.
                  </div>
                ) : (
                  approvalQueue.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${getDataTypeBadge(request.archivedRecord.dataType)}`}>
                              {formatDataType(request.archivedRecord.dataType)}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(request.status)}`}>
                              {formatStatus(request.status)}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-black text-foreground">
                            {request.archivedRecord.spmNumber || `${request.archivedRecord.dataType} #${request.archivedRecord.id}`}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Requested by {request.requestedBy.name}
                          </p>
                          {request.reason && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Alasan: {request.reason}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {canApproveDisposal ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproval(request.archivedRecord.id, "approve")}
                                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproval(request.archivedRecord.id, "reject")}
                                className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-200"
                              >
                                <Trash2 className="h-4 w-4" />
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
                              Mode lihat saja
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "ringkasan" && (
              <div className="space-y-8">
                {loadingSummary ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                    Memuat ringkasan arsip...
                  </div>
                ) : summary ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Periode
                        </div>
                        <div className="mt-2 text-lg font-black text-foreground">
                          {summary.period}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Status ringkasan
                        </div>
                        <div className="mt-2 text-lg font-black text-foreground">
                          {summary.status}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Total log akses
                        </div>
                        <div className="mt-2 text-lg font-black text-foreground">
                          {summary.summary?.totalAccessLogs ?? 0}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <section className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                        <h3 className="text-lg font-black text-foreground">
                          Ringkasan status arsip
                        </h3>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {Object.entries(retentionTimeline).map(([status, count]) => (
                            <div key={status} className="rounded-2xl bg-muted/40 p-4">
                              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                {formatStatus(status)}
                              </div>
                              <div className="mt-2 text-2xl font-black text-foreground">
                                {count}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                        <h3 className="text-lg font-black text-foreground">
                          Ringkasan per jenis dokumen
                        </h3>
                        <div className="mt-4 space-y-3">
                          {Object.entries(byDataTypeSummary).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                              <div className="font-semibold text-foreground">
                                {formatDataType(type)}
                              </div>
                              <div className="font-black text-foreground">{count}</div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    <section className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-black text-foreground">
                          5 akses terakhir
                        </h3>
                        <span className="text-sm text-muted-foreground">
                          Ini log akses, bukan compliance jargon.
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {accessAudit.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                            Belum ada log akses arsip.
                          </div>
                        ) : (
                          accessAudit.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-foreground">
                                    {item.archivedRecord.spmNumber || item.archivedRecord.dataType}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {item.accessType} oleh {item.accessedBy?.name || "-"}
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDate(item.createdAt)}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                    Ringkasan belum tersedia.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedDossier && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm md:items-center">
            <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-border/70 bg-background shadow-2xl">
              <div className="flex flex-col gap-4 border-b border-border/70 px-6 py-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Detail dosier
                  </div>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                    {buildDossierTitle(selectedDossier)}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground">
                      {buildDossierIndex(selectedDossier)}
                    </span>
                    <span className="rounded-full bg-sky-500/10 px-3 py-1 font-semibold text-sky-700 dark:text-sky-300">
                      {buildDossierStatus(selectedDossier)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDossier(null)}
                  className="rounded-full bg-muted p-2 text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-border/70 px-6 py-4">
                {[
                  { key: "indeks", label: "Indeks", icon: FileText },
                  { key: "status", label: "Status", icon: ShieldCheck },
                  { key: "riwayat", label: "Riwayat", icon: Clock3 },
                  { key: "lampiran", label: "Lampiran", icon: Paperclip },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedDossierTab(tab.key as typeof selectedDossierTab)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                        selectedDossierTab === tab.key
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                    >
                      <TabIcon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-5">
                  {selectedDossierTab === "indeks" && (
                    <section className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Indeks
                        </div>
                        <div className="mt-2 text-xl font-black text-foreground">
                          {buildDossierIndex(selectedDossier)}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Nomor pakai untuk identifikasi cepat saat petugas cari satu paket arsip.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Jenis dokumen
                        </div>
                        <div className="mt-2 text-xl font-black text-foreground">
                          {selectedDossier.kind === "dynamic"
                            ? "Arsip dinamis"
                            : selectedDossier.kind === "stored"
                              ? "Storage permanen"
                              : formatDataType(selectedDossier.record.dataType)}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {selectedDossier.kind === "dynamic"
                            ? "Masih dalam masa pakai atau menunggu pemindahan."
                            : "Sudah dicatat sebagai arsip permanen."}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Ringkasan
                        </div>
                        <div className="mt-2 text-base font-semibold text-foreground">
                          {buildDossierTitle(selectedDossier)}
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {getDossierNotes(selectedDossier).map((note) => (
                            <p key={note}>{note}</p>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Tampilan cepat
                        </div>
                        <div className="mt-2 space-y-2">
                          <div className="rounded-2xl bg-background px-4 py-3 text-sm">
                            <span className="block text-xs uppercase tracking-widest text-muted-foreground">SPM</span>
                            <span className="font-semibold text-foreground">
                              {selectedDossier.kind === "dynamic"
                                ? selectedDossier.record.spmNumber
                                : selectedDossier.kind === "stored"
                                  ? selectedDossier.record.dossierIndex
                                  : selectedDossier.record.spmNumber || `#${selectedDossier.record.originalId}`}
                            </span>
                          </div>
                          <div className="rounded-2xl bg-background px-4 py-3 text-sm">
                            <span className="block text-xs uppercase tracking-widest text-muted-foreground">Status</span>
                            <span className="font-semibold text-foreground">{buildDossierStatus(selectedDossier)}</span>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {selectedDossierTab === "status" && (
                    <section className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Status saat ini
                        </div>
                        <div className="mt-2 text-2xl font-black text-foreground">
                          {buildDossierStatus(selectedDossier)}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Status dipakai untuk menentukan apakah dosier masih aktif, menunggu pemindahan, atau sudah permanen.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Retensi
                        </div>
                        <div className="mt-2 text-2xl font-black text-foreground">
                          {selectedDossier.kind === "dynamic"
                            ? `${selectedDossier.record.retentionProgress.percentage}%`
                            : selectedDossier.kind === "stored"
                              ? `Tersimpan ${formatDate(selectedDossier.record.createdAt)}`
                              : selectedDossier.record.disposalScheduledDate
                                ? `Jadwal ${formatDate(selectedDossier.record.disposalScheduledDate)}`
                                : "Menunggu jadwal"}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Untuk arsip pemerintahan, status ini membantu petugas lihat kapan dokumen dipindahkan atau ditahan.
                        </p>
                      </div>
                    </section>
                  )}

                  {selectedDossierTab === "riwayat" && (
                    <section className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Riwayat dosier
                      </div>
                      <div className="mt-4 space-y-3">
                        {getDossierHistory(selectedDossier).map((item) => (
                          <div key={`${item.title}-${item.time}`} className="rounded-2xl bg-background px-4 py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-semibold text-foreground">{item.title}</div>
                                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(item.time)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {selectedDossierTab === "lampiran" && (
                    <section className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Lampiran dosier
                      </div>
                      <div className="mt-4 space-y-3">
                        {getSourceAttachments(selectedDossier).map((attachment) => (
                          <div key={`${attachment.name}-${attachment.size}`} className="rounded-2xl bg-background px-4 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-foreground">{attachment.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {attachment.type} · {formatBytes(attachment.size)}
                                </div>
                              </div>
                              <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                PDF
                              </span>
                            </div>
                          </div>
                        ))}

                        {selectedDossier.kind !== "stored" && selectedDossierAttachments.length > 0 && (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-background/80 p-4">
                            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                              Lampiran sementara
                            </div>
                            <div className="mt-3 space-y-2">
                              {selectedDossierAttachments.map((attachment) => (
                                <div key={`${attachment.name}-${attachment.size}`} className="flex items-center justify-between gap-4 rounded-2xl bg-muted/30 px-4 py-3 text-sm">
                                  <div className="truncate font-medium text-foreground">{attachment.name}</div>
                                  <div className="text-xs text-muted-foreground">{formatBytes(attachment.size)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </div>

                <aside className="space-y-4">
                  <div className="rounded-3xl border border-border/70 bg-card/90 p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-foreground" />
                        <h4 className="text-sm font-black uppercase tracking-widest text-foreground">
                          {selectedDossier.kind === "stored" ? "Tambah lampiran permanen" : "Upload lampiran"}
                        </h4>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {selectedDossier.kind === "stored"
                          ? "Lampiran yang ditambahkan di sini langsung tersimpan permanen ke dosier ini."
                          : "Bisa upload beberapa PDF sekaligus ke dosier ini. Kalau belum ada semua berkas, simpan dulu sebagian."}
                      </p>
                    <label className="mt-4 block">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg"
                        disabled={isAppendingAttachment}
                        onChange={(event) => handleAttachmentUpload(event.target.files)}
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-semibold file:text-background hover:file:bg-foreground/90"
                      />
                    </label>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Idealnya lampiran utama dulu, lalu bukti pendukung lain. Jadi petugas tetap bisa baca dosier per kasus.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border/70 bg-card/90 p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-foreground" />
                      <h4 className="text-sm font-black uppercase tracking-widest text-foreground">
                        Ringkasan lampiran
                      </h4>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3 text-sm">
                        <span className="text-muted-foreground">Lampiran bawaan</span>
                        <span className="font-semibold text-foreground">{getSourceAttachments(selectedDossier).length}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3 text-sm">
                        <span className="text-muted-foreground">Lampiran sesi</span>
                        <span className="font-semibold text-foreground">{selectedDossierAttachments.length}</span>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Skema pengelompokan
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Arsip ditampilkan sebagai dosier. Setiap dosier punya indeks, status, riwayat,
                dan lampiran. Persetujuan admin hanya untuk mencatat proses arsip, bukan untuk menghapus permanen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                1. Indeks
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                2. Status
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                3. Riwayat & lampiran
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5" />
          Export PDF/CSV masih placeholder sampai model retensi, pemindahan, dan pemusnahan disepakati.
        </div>
      </div>
    </div>
  );
}
