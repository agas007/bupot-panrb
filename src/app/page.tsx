"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from "recharts";
import { 
  Users, 
  ClipboardCheck, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  Layers,
  ChevronDown,
  X
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface DashboardStats {
  total: number;
  completed: number;
  unassigned: number;
  colleagueStats: Array<{
    name: string;
    completed: number;
    total: number;
    percentage: number;
  }>;
  monthlyStats: Array<{
    key: string;
    label: string;
    completed: number;
    total: number;
    percentage: number;
  }>;
}

export default function Dashboard() {
  const { language, t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [showFilter, setShowFilter] = useState(false);

  // 🔥 NEW: Dynamic Years Generation
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      years.push(i);
    }
    return years;
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, [selectedYear, selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard?year=${selectedYear}&month=${selectedMonth}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) return <div className="p-8 opacity-50">{language === "ID" ? "Memuat beranda..." : "Initializing dashboard..."}</div>;

  const COLORS = ["#00BFA5", "#FFAB00", "#FF5252", "#7C4DFF"];
  const monthNamesID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const monthNamesEN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNames = language === "ID" ? monthNamesID : monthNamesEN;

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex flex-col gap-2 text-left">
          <h1 className="text-4xl font-extrabold tracking-tight">{t.dashboard.title}</h1>
          <p className="text-muted-foreground font-medium">{t.dashboard.subtitle}</p>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowFilter(!showFilter)}
            className="glass-card px-6 py-3 flex items-center gap-3 text-sm font-semibold hover:bg-white/10 transition-colors shadow-lg"
          >
            <Calendar size={16} className="text-accent" />
            {selectedMonth === "all" ? selectedYear : `${monthNames[Number(selectedMonth)-1]} ${selectedYear}`}
            <ChevronDown size={14} className={`transition-transform duration-300 ${showFilter ? "rotate-180" : ""}`} />
          </button>

          {showFilter && (
            <div className="absolute right-0 mt-3 w-64 glass-card p-6 z-100 shadow-2xl animate-in fade-in slide-in-from-top-2 border-accent/20">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-black uppercase tracking-widest opacity-50">Filter Periode</span>
                <button onClick={() => setShowFilter(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X size={16}/></button>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{language === "ID" ? "Tahun Pajak" : "Tax Year"}</label>
                  <div className="relative">
                    <select 
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="bg-muted/50 p-3 rounded-xl text-sm font-bold outline-none w-full appearance-none cursor-pointer hover:bg-muted transition-colors"
                    >
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{language === "ID" ? "Masa Pajak" : "Tax Month"}</label>
                  <div className="relative">
                    <select 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-muted/50 p-3 rounded-xl text-sm font-bold outline-none w-full appearance-none cursor-pointer hover:bg-muted transition-colors"
                    >
                      <option value="all">{language === "ID" ? "Setahun Penuh" : "Full Year"}</option>
                      {monthNames.map((m, i) => <option key={m} value={(i + 1).toString()}>{m}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="glass-card metric-card group hover:border-accent transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="metric-label">{t.dashboard.total_data}</span>
            <Layers className="text-muted-foreground group-hover:text-accent transition-colors underline decoration-accent/30 underline-offset-4" size={20} />
          </div>
          <span className="metric-value tracking-tighter">{stats.total.toLocaleString()}</span>
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-accent w-full opacity-20"></div>
          </div>
        </div>

        <div className="glass-card metric-card group hover:border-emerald-500 transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="metric-label">{t.dashboard.progress}</span>
            <ClipboardCheck className="text-muted-foreground group-hover:text-emerald-500 transition-colors" size={20} />
          </div>
          <span className="metric-value text-emerald-500 tracking-tighter">
            {stats.total > 0 ? Math.round((stats.completed / (stats.total || 1)) * 100) : 0}%
          </span>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3 shadow-inner">
            <div 
              className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000" 
              style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="glass-card metric-card group hover:border-amber-500 transition-all duration-300 border-l-4 border-l-amber-500/10">
          <div className="flex justify-between items-start">
            <span className="metric-label">{t.dashboard.unassigned}</span>
            <AlertCircle className="text-muted-foreground group-hover:text-amber-500 transition-colors" size={20} />
          </div>
          <span className="metric-value text-amber-500 tracking-tighter">{stats.unassigned.toLocaleString()}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2 opacity-60 italic">{t.dashboard.unassigned_hint}</span>
        </div>

        <div className="glass-card metric-card group hover:border-accent transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="metric-label">{t.dashboard.active_members}</span>
            <Users className="text-muted-foreground group-hover:text-accent transition-colors" size={20} />
          </div>
          <span className="metric-value tracking-tighter">{stats.colleagueStats.length}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2 opacity-60 italic">{t.dashboard.members_hint}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="glass-card p-8 flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" /> {t.dashboard.efficiency}
          </h2>
          <div className="chart-container mt-4">
            {isMounted && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.colleagueStats} margin={{ bottom: 40 }}>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: "currentColor", opacity: 0.5 }}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, opacity: 0.5 }} unit="%" domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.1 }}
                    contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "12px" }}
                    itemStyle={{ fontWeight: 800, fontSize: "12px" }}
                  />
                  <Bar dataKey="percentage" radius={[8, 8, 0, 0]} barSize={40}>
                    {stats.colleagueStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="glass-card p-8 flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={20} className="text-accent" /> {t.dashboard.compliance_title}
          </h2>
          <div className="flex flex-col gap-6 mt-2">
            {stats.monthlyStats.map((month) => (
              <div key={month.key} className="flex flex-col gap-2 group">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold tracking-tight group-hover:text-accent transition-colors">{month.label}</span>
                  <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60 tracking-wider">
                    {month.completed.toLocaleString()} / {month.total.toLocaleString()} {language === "ID" ? "Selesai" : "Completed"}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-accent transition-all duration-1000 shadow-[0_0_10px_rgba(0,191,165,0.3)]" 
                    style={{ width: `${month.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {stats.monthlyStats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 opacity-50">
                <X size={32} />
                <p className="text-xs font-bold uppercase tracking-widest">{language === "ID" ? "Data Bulanan Kosong" : "No Monthly Data"}</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="glass-card overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">{t.dashboard.task_load}</h2>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 italic">
            <AlertCircle size={14} /> Update Real-time
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr className="bg-muted/10">
                <th className="p-6 text-left">{t.dashboard.colleague}</th>
                <th className="p-6 text-center">{t.dashboard.task_progress}</th>
                <th className="p-6 text-right whitespace-nowrap">{t.dashboard.status}</th>
              </tr>
            </thead>
            <tbody>
              {stats.colleagueStats.map((col) => (
                <tr key={col.name} className="hover:bg-white/5 transition-colors group">
                  <td className="p-6"><span className="font-bold text-lg decoration-accent/30 group-hover:underline underline-offset-4">{col.name}</span></td>
                  <td className="p-6">
                    <div className="flex items-center gap-6 max-w-sm mx-auto">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${col.percentage}%` }}></div>
                      </div>
                      <span className="text-xs font-black w-12 tabular-nums">{col.percentage}%</span>
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold tracking-tight">
                        {col.completed.toLocaleString()} / {col.total.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">
                        {language === "ID" ? "Tugas Terinput" : "Tasks Inputted"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
