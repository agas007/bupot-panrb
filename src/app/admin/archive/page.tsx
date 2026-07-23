"use client";

import { useEffect, useState } from "react";
import {
  Archive, CheckCircle, AlertCircle, Trash2, Eye, Download,
} from "lucide-react";

interface ArchiveStats {
  ACTIVE: number;
  INACTIVE: number;
  ARCHIVED: number;
  DISPOSED: number;
}

interface ArchiveRecord {
  id: number;
  spmNumber: string;
  spmDate: string;
  accountCode: string;
  sp2dNumber?: string;
  recipient?: string;
  archiveStatus: string;
  importDate: string;
}

interface DisposalRequest {
  id: number;
  archivedRecordId: number;
  archivedRecord: {
    id: number;
    spmNumber?: string;
    dataType: string;
  };
  requestedBy: { name: string };
  approvedBy?: { name: string };
  status: string;
  createdAt: string;
}

interface ComplianceData {
  period: string;
  status: string;
  retentionTimeline: ArchiveStats;
  accessAudit: any[];
  disposalQueue: { pending: number; approved: number };
  complianceMetrics: Record<string, string>;
}

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState<"view" | "disposal" | "compliance">(
    "view"
  );
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [disposalPending, setDisposalPending] = useState(0);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [disposalRequests, setDisposalRequests] = useState<DisposalRequest[]>([]);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/archive/stats");
        const data = await res.json();
        setStats(data.stats);
        setDisposalPending(data.disposalPending);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    fetchStats();
  }, []);

  // Fetch records when status filter changes
  useEffect(() => {
    const fetchRecords = async () => {
      setIsLoading(true);
      try {
        let url = "/api/archive/records";
        if (selectedStatus) url += `?status=${selectedStatus}`;
        const res = await fetch(url);
        const data = await res.json();
        setRecords(data.data || []);
      } catch (error) {
        console.error("Failed to fetch records:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [selectedStatus]);

  // Fetch disposal requests
  useEffect(() => {
    if (activeTab === "disposal") {
      const fetchDisposal = async () => {
        try {
          const res = await fetch("/api/archive/disposal?status=PENDING");
          const data = await res.json();
          setDisposalRequests(data.data || []);
        } catch (error) {
          console.error("Failed to fetch disposal requests:", error);
        }
      };

      fetchDisposal();
    }
  }, [activeTab]);

  // Fetch compliance report
  useEffect(() => {
    if (activeTab === "compliance") {
      const fetchCompliance = async () => {
        try {
          const res = await fetch("/api/archive/compliance-report");
          const data = await res.json();
          setComplianceData(data);
        } catch (error) {
          console.error("Failed to fetch compliance report:", error);
        }
      };

      fetchCompliance();
    }
  }, [activeTab]);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-yellow-100 text-yellow-800",
      INACTIVE: "text-gray-800 bg-gray-100",
      ARCHIVED: "bg-green-100 text-green-800",
      DISPOSED: "bg-red-100 text-red-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleApproveDisposal = async (recordId: number) => {
    try {
      await fetch("/api/archive/disposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archivedRecordId: recordId,
          approvedById: 1, // TODO: get from session
          action: "approve",
          reason: "Approved by admin",
        }),
      });
      // Refresh disposal list
      const res = await fetch("/api/archive/disposal?status=PENDING");
      const data = await res.json();
      setDisposalRequests(data.data || []);
    } catch (error) {
      console.error("Failed to approve disposal:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Archive className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Archive Management
            </h1>
          </div>
          <p className="text-gray-600">
            Kelola pengarsipan data sesuai regulasi PP No. 28 Tahun 2012
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-2">Active Data</div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.ACTIVE}
              </div>
              <div className="text-xs text-gray-500 mt-2">0-1 tahun</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-2">Inactive Data</div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.INACTIVE}
              </div>
              <div className="text-xs text-gray-500 mt-2">1-5 tahun</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-2">Archived</div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.ARCHIVED}
              </div>
              <div className="text-xs text-gray-500 mt-2">5+ tahun</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-2">Pending Disposal</div>
              <div className="text-3xl font-bold text-red-600">
                {disposalPending}
              </div>
              <div className="text-xs text-gray-500 mt-2">needs approval</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("view")}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm ${
                activeTab === "view"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Archive className="w-4 h-4" />
              View All
            </button>
            <button
              onClick={() => setActiveTab("disposal")}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm ${
                activeTab === "disposal"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Pending Approval
            </button>
            <button
              onClick={() => setActiveTab("compliance")}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm ${
                activeTab === "compliance"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Compliance Report
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "view" && (
              <div>
                <div className="mb-6 flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedStatus(null)}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      selectedStatus === null
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    All
                  </button>
                  {Object.keys(stats || {}).map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`px-4 py-2 rounded text-sm font-medium ${
                        selectedStatus === status
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {isLoading ? (
                  <div className="text-center py-8">Loading records...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left px-4 py-3 font-medium text-gray-700">
                            SPM Number
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">
                            Period
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">
                            Recipient
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">
                            Status
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr
                            key={record.id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 font-medium">
                              {record.spmNumber}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {new Date(record.spmDate).toLocaleDateString(
                                "id-ID"
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {record.recipient || "-"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-3 py-1 rounded text-xs font-medium ${getStatusBadge(
                                  record.archiveStatus
                                )}`}
                              >
                                {record.archiveStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                                <Eye className="w-4 h-4" /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "disposal" && (
              <div>
                {disposalRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No pending disposal requests
                  </div>
                ) : (
                  <div className="space-y-4">
                    {disposalRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {request.archivedRecord.spmNumber ||
                                `${request.archivedRecord.dataType} #${request.id}`}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Requested by {request.requestedBy.name}
                            </p>
                          </div>
                          <span
                            className={`inline-block px-3 py-1 rounded text-xs font-medium ${getStatusBadge(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>
                        </div>
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={() =>
                              handleApproveDisposal(request.archivedRecord.id)
                            }
                            className="px-4 py-2 bg-red-600 text-white rounded font-medium text-sm hover:bg-red-700"
                          >
                            Approve Soft Delete
                          </button>
                          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded font-medium text-sm hover:bg-gray-200">
                            Reject
                          </button>
                          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded font-medium text-sm hover:bg-gray-200">
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "compliance" && complianceData && (
              <div>
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-gray-900">
                      Compliance Status: {complianceData.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {Object.entries(complianceData.complianceMetrics).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="bg-gray-50 rounded-lg p-4 text-center"
                        >
                          <div className="text-sm text-gray-600 mb-2">
                            {key.replace(/_/g, " ")}
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            {value}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Retention Timeline */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase text-gray-700 mb-4">
                    Retention Timeline
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {Object.entries(complianceData.retentionTimeline).map(
                      ([status, count]) => (
                        <div
                          key={status}
                          className="bg-white border border-gray-200 rounded-lg p-4"
                        >
                          <div className="text-sm text-gray-600 mb-2">
                            {status}
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {count}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Export buttons */}
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export as PDF
                  </button>
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded font-medium text-sm hover:bg-gray-200 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export as CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
