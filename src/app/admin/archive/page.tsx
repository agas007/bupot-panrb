"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Archive, CheckCircle, Download, Eye, FolderTree, ShieldCheck, Trash2 } from "lucide-react";

type ArchiveStatus = "ARCHIVED" | "PENDING_APPROVAL" | "REJECTED" | "DISPOSED";
type DataType = "SPM_RECORD" | "PPH21_WITHHOLDING" | "TAX_RECONCILIATION";

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
  const [activeTab, setActiveTab] = useState<"data" | "approval" | "ringkasan">("data");
  const [stats, setStats] = useState<ArchiveStatsResponse | null>(null);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [summary, setSummary] = useState<ArchiveSummaryResponse | null>(null);
  const [approvalQueue, setApprovalQueue] = useState<DisposalRequest[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedDataType, setSelectedDataType] = useState<string | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingApproval, setLoadingApproval] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, [selectedStatus, selectedDataType]);

  useEffect(() => {
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
  }, [activeTab]);

  useEffect(() => {
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
  }, [activeTab]);

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
                Archive Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Kerangka list arsip: grup per tipe data, status, dan jejak approval admin.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Total arsip
            </div>
            <div className="mt-2 text-3xl font-black text-foreground">
              {stats?.total ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Pending approval
            </div>
            <div className="mt-2 text-3xl font-black text-amber-600">
              {stats?.disposalPending ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Tipe arsip
            </div>
            <div className="mt-2 text-3xl font-black text-foreground">
              {Object.keys(stats?.byDataType || {}).length}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Akses terbaru
            </div>
            <div className="mt-2 text-3xl font-black text-foreground">
              {summary?.summary?.totalAccessLogs ?? 0}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap border-b border-border/70">
            <button
              type="button"
              onClick={() => setActiveTab("data")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold ${
                activeTab === "data"
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderTree className="h-4 w-4" />
              List Arsip
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
            {activeTab === "data" && (
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
                    Memuat data arsip...
                  </div>
                ) : sortedDataTypes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                    Belum ada data arsip yang cocok dengan filter ini.
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
                                  {items.length} arsip
                                </span>
                              </div>
                              <h2 className="mt-2 text-xl font-black tracking-tight text-foreground">
                                {formatDataType(type)}
                              </h2>
                              <p className="text-sm text-muted-foreground">
                                Grup ini menampilkan arsip permanen, status approval, dan siapa yang melakukan arsip.
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
                                        className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Lihat
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
                  Hanya admin yang bisa approve. Untuk sementara approve artinya dicatat, bukan destroy.
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
                          Ringkasan per tipe data
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

        <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Skema pengelompokan
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Arsip ditampilkan per jenis dokumen, lalu dipisah lagi berdasarkan
                statusnya. Persetujuan admin hanya untuk mencatat proses arsip,
                bukan untuk menghapus permanen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                1. Tipe data
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                2. Status arsip
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                3. Approval admin
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5" />
          Export PDF/CSV masih placeholder sampai flow destroy/retain-nya benar-benar final.
        </div>
      </div>
    </div>
  );
}
