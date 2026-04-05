"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  FileCheck, 
  Clock, 
  ExternalLink, 
  CheckCircle2, 
  Calendar,
  AlertCircle,
  ArrowUpDown,
  Filter,
  Search,
  ChevronDown
} from "lucide-react";

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export default function RecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

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

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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
    if (!sp2dDate) return { label: "N/A", type: "neutral", date: null };
    const date = new Date(sp2dDate);
    const targetDate = new Date(date.getFullYear(), date.getMonth() + 1, 15);
    const today = new Date();
    
    const diff = targetDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diff / (1000 * 3600 * 24));

    if (daysLeft < 0) return { label: `Overdue (${Math.abs(daysLeft)}d)`, type: "overdue", date: targetDate };
    if (daysLeft < 5) return { label: `Due soon (${daysLeft}d)`, type: "soon", date: targetDate };
    return { label: `Target: ${targetDate.toLocaleDateString("id-ID")}`, type: "ok", date: targetDate };
  };

  // Get unique account codes for filter dropdown
  const uniqueAccounts = useMemo(() => {
    const accounts = new Set(records.map(r => r.accountCode).filter(Boolean));
    return Array.from(accounts).sort();
  }, [records]);

  // Derived data with filtering and sorting
  const processedRecords = useMemo(() => {
    let result = [...records];

    // Filter by search (SPM, SP2D, Recipient)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.spmNumber?.toLowerCase().includes(q) ||
        r.sp2dNumber?.toLowerCase().includes(q) ||
        r.recipient?.toLowerCase().includes(q)
      );
    }

    // Filter by Account Code
    if (accountFilter !== "all") {
      result = result.filter(r => r.accountCode === accountFilter);
    }

    // Sorting logic
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal, bVal;
        
        switch (sortConfig.key) {
          case 'spm': aVal = a.spmNumber; bVal = b.spmNumber; break;
          case 'sp2d': aVal = a.sp2dNumber; bVal = b.sp2dNumber; break;
          case 'akun': aVal = a.accountCode; bVal = b.accountCode; break;
          case 'recipient': aVal = a.recipient; bVal = b.recipient; break;
          case 'assignee': 
            aVal = colleagues.find(c => c.id === a.assigneeId)?.name || "";
            bVal = colleagues.find(c => c.id === b.assigneeId)?.name || "";
            break;
          case 'deadline':
            aVal = a.sp2dDate ? new Date(a.sp2dDate).getTime() : 0;
            bVal = b.sp2dDate ? new Date(b.sp2dDate).getTime() : 0;
            break;
          default: aVal = 0; bVal = 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [records, searchQuery, accountFilter, sortConfig, colleagues]);

  const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
    <th 
      className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown size={14} className={`transition-opacity ${sortConfig?.key === sortKey ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-40"}`} />
      </div>
    </th>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Data Worksheet</h1>
          <p className="text-muted-foreground">Monitor and update the status of Bukti Potong generation.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search data..." 
              className="w-full bg-muted border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Account Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <select 
              className="bg-muted border-none rounded-xl pl-10 pr-10 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="all">Semua Akun</option>
              {uniqueAccounts.map(acc => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
          </div>
        </div>
      </header>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <SortHeader label="SPM Details" sortKey="spm" />
                <SortHeader label="SP2D Details" sortKey="sp2d" />
                <SortHeader label="Akun" sortKey="akun" />
                <SortHeader label="Recipient & Amount" sortKey="recipient" />
                <SortHeader label="Deadline" sortKey="deadline" />
                <SortHeader label="Assignee" sortKey="assignee" />
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center p-8">Loading data...</td></tr>
              ) : processedRecords.length === 0 ? (
                <tr><td colSpan={8} className="text-center p-8">Belum ada data yang cocok.</td></tr>
              ) : (
                processedRecords.map((record) => {
                  const deadline = getDeadlineStatus(record.sp2dDate);
                  return (
                    <tr key={record.id}>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold">{record.spmNumber}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-2">
                            <Calendar size={12} /> {new Date(record.spmDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-xs italic truncate max-w-[150px] opacity-60" title={record.description}>
                            {record.description}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm">{record.sp2dNumber || "-"}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar size={10} /> {record.sp2dDate ? new Date(record.sp2dDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' }) : "Belum terbit"}
                          </span>
                        </div>
                      </td>
                      <td>
                         <span className="badge bg-primary/5 text-primary border border-primary/10 font-mono text-xs">
                           {record.accountCode}
                         </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm line-clamp-1 max-w-[200px]">{record.recipient}</span>
                          <span className="text-xs font-bold text-accent">
                            IDR {record.deductionAmount.toLocaleString("id-ID")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={`p-2 rounded-xl flex flex-col gap-1 ${
                          deadline.type === "overdue" ? "bg-rose-500/10 text-rose-500" : 
                          deadline.type === "soon" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                        }`}>
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                            {deadline.type === "overdue" ? <AlertCircle size={12} /> : <Clock size={12} />}
                            {deadline.type}
                          </div>
                          <span className="text-xs font-medium">
                            {deadline.label}
                          </span>
                        </div>
                      </td>
                      <td>
                        <select 
                          className="bg-muted border-none rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-accent cursor-pointer w-full max-w-[120px]"
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
                        <div className="flex items-center gap-1">
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
    </div>
  );
}
