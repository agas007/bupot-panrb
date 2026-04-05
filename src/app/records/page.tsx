"use client";

import { useEffect, useState } from "react";
import { 
  FileCheck, 
  Clock, 
  ExternalLink, 
  UserPlus, 
  CheckCircle2, 
  Calendar,
  AlertCircle
} from "lucide-react";

export default function RecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [recRes, colRes] = await Promise.all([
        fetch("/api/records"),
        fetch("/api/colleagues")
      ]);
      const [recData, colData] = await Promise.all([recRes.json(), colRes.json()]);
      setRecords(recData);
      setColleagues(colData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch("/api/records", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const assignColleague = async (id: number, assigneeId: number) => {
    try {
      const res = await fetch("/api/records", {
        method: "PATCH",
        body: JSON.stringify({ id, assigneeId }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const getDeadlineStatus = (sp2dDate: string) => {
    if (!sp2dDate) return { label: "N/A", type: "neutral" };
    const date = new Date(sp2dDate);
    const targetDate = new Date(date.getFullYear(), date.getMonth() + 1, 15);
    const today = new Date();
    
    const diff = targetDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diff / (1000 * 3600 * 24));

    if (daysLeft < 0) return { label: `Overdue (${Math.abs(daysLeft)}d)`, type: "overdue" };
    if (daysLeft < 5) return { label: `Due soon (${daysLeft}d)`, type: "soon" };
    return { label: `Target: ${targetDate.toLocaleDateString("id-ID")}`, type: "ok" };
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Data Worksheet</h1>
          <p className="text-muted-foreground">Monitor and update the status of Bukti Potong generation.</p>
        </div>
      </header>

      <div className="glass-card overflow-hidden">
        <table className="premium-table">
          <thead>
            <tr>
              <th>SPM Details</th>
              <th>Recipient & Amount</th>
              <th>Deadline</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center p-8">Loading data...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6} className="text-center p-8">No records found. Import data from Admin panel.</td></tr>
            ) : (
              records.map((record) => {
                const deadline = getDeadlineStatus(record.sp2dDate);
                return (
                  <tr key={record.id}>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold">{record.spmNumber}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar size={12} /> {new Date(record.spmDate).toLocaleDateString("id-ID")}
                        </span>
                        <span className="text-xs italic truncate max-w-[200px]">{record.description}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">{record.recipient}</span>
                        <span className="text-xs font-bold text-accent">
                          IDR {record.deductionAmount.toLocaleString("id-ID")} (Akun: {record.accountCode})
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className={`flex items-center gap-2 text-xs font-semibold ${
                        deadline.type === "overdue" ? "text-rose-500" : 
                        deadline.type === "soon" ? "text-amber-500" : "text-emerald-500"
                      }`}>
                        {deadline.type === "overdue" ? <AlertCircle size={14} /> : <Clock size={14} />}
                        {deadline.label}
                      </div>
                    </td>
                    <td>
                      <select 
                        className="bg-muted border-none rounded-lg p-1 text-xs outline-none focus:ring-1 focus:ring-accent"
                        value={record.assigneeId || ""}
                        onChange={(e) => assignColleague(record.id, Number(e.target.value))}
                      >
                        <option value="">Unassigned</option>
                        {colleagues.map((col: any) => (
                          <option key={col.id} value={col.id}>{col.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className={`badge ${record.status === "COMPLETED" ? "badge-completed" : "badge-pending"}`}>
                        {record.status}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {record.status === "PENDING" ? (
                          <button 
                            onClick={() => updateStatus(record.id, "COMPLETED")}
                            className="p-2 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 rounded-lg transition-colors"
                            title="Mark as Selesai"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => updateStatus(record.id, "PENDING")}
                            className="p-2 hover:bg-amber-500/10 text-emerald-500 hover:text-amber-500 rounded-lg transition-colors"
                            title="Revert to Pending"
                          >
                            <FileCheck size={18} />
                          </button>
                        )}
                        <button className="p-2 hover:bg-accent/10 text-muted-foreground hover:text-accent rounded-lg transition-colors">
                          <ExternalLink size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
