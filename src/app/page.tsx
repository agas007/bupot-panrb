"use client";

import { useEffect, useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from "recharts";
import { 
  Users, 
  ClipboardCheck, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  Layers
} from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetch("/api/dashboard")
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setIsLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  if (isLoading) return <div className="p-8 opacity-50">Initializing dashboard...</div>;

  const COLORS = ["#00BFA5", "#FFAB00", "#FF5252", "#7C4DFF"];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">Bupot PANRB Dashboard</h1>
          <p className="text-muted-foreground font-medium">Real-time monitoring of tax slip generation and compliance.</p>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2 text-sm font-semibold">
          <Calendar size={16} className="text-accent" />
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
      </header>

      {/* Metric Cards */}
      <div className="dashboard-grid">
        <div className="glass-card metric-card group hover:border-accent transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="metric-label">Total Records</span>
            <Layers className="text-muted-foreground group-hover:text-accent transition-colors" size={20} />
          </div>
          <span className="metric-value">{stats.total}</span>
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-accent w-full opacity-20"></div>
          </div>
        </div>

        <div className="glass-card metric-card group hover:border-emerald-500 transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="metric-label">Overall Completion</span>
            <ClipboardCheck className="text-muted-foreground group-hover:text-emerald-500 transition-colors" size={20} />
          </div>
          <span className="metric-value text-emerald-500">
            {stats.total > 0 ? Math.round((stats.completed / (stats.total || 1)) * 100) : 0}%
          </span>
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
            <div 
              className="h-full bg-emerald-500" 
              style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="glass-card metric-card group hover:border-amber-500 transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="metric-label">Unassigned Tasks</span>
            <AlertCircle className="text-muted-foreground group-hover:text-amber-500 transition-colors" size={20} />
          </div>
          <span className="metric-value text-amber-500">{stats.unassigned}</span>
          <span className="text-xs text-muted-foreground mt-2 font-medium">Needs allocation in Admin panel</span>
        </div>

        <div className="glass-card metric-card group hover:border-accent transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="metric-label">Active Team members</span>
            <Users className="text-muted-foreground group-hover:text-accent transition-colors" size={20} />
          </div>
          <span className="metric-value">{stats.colleagueStats.length}</span>
          <span className="text-xs text-muted-foreground mt-2 font-medium">Collaborating on tax records</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Performance Chart */}
        <section className="glass-card p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" /> Team Efficiency
          </h2>
          <div className="chart-container">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.colleagueStats}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "12px", border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                    {stats.colleagueStats.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Monthly Compliance */}
        <section className="glass-card p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={20} className="text-accent" /> Compliance by Month
          </h2>
          <div className="flex flex-col gap-4">
            {stats.monthlyStats.map((month: any) => (
              <div key={month.month} className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold">{month.month} (SP2D)</span>
                  <span className="text-muted-foreground">{month.completed} / {month.total} Selesai</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-1000" 
                    style={{ width: `${month.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {stats.monthlyStats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">No monthly data available yet.</p>
            )}
          </div>
        </section>
      </div>

      {/* Top Performers Table Snippet */}
      <section className="glass-card overflow-hidden">
        <div className="p-6 border-bottom border-border">
          <h2 className="text-xl font-bold">Individual Task Load</h2>
        </div>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Colleague</th>
              <th>Task Progress</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.colleagueStats.map((col: any) => (
              <tr key={col.name}>
                <td><span className="font-bold">{col.name}</span></td>
                <td>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${col.percentage}%` }}></div>
                    </div>
                    <span className="text-xs font-bold w-12">{col.percentage}%</span>
                  </div>
                </td>
                <td>
                  <span className="text-xs text-muted-foreground font-medium">
                    {col.completed} of {col.total} completed
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
