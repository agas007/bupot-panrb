"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Shield, User, Loader2, KeyRound, AtSign, ChevronDown } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function ColleaguesPage() {
  const { language, t } = useLanguage();
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchColleagues();
  }, []);

  const fetchColleagues = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/colleagues");
      const data = await res.json();
      setColleagues(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const addColleague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSubmitting(true);
    try {
      const simulatedUser = localStorage.getItem("sim_user");
      const currentUserName = simulatedUser ? JSON.parse(simulatedUser).name : "Admin (Simulated)";
      const currentUserUsername = simulatedUser ? JSON.parse(simulatedUser).username : "admin";

      const res = await fetch("/api/colleagues", {
        method: "POST",
        headers: { 
          "x-simulated-user": currentUserName,
          "x-simulated-username": currentUserUsername
        },
        body: JSON.stringify({ 
          name, 
          username: username.toLowerCase() || undefined, 
          password: password || undefined, 
          role 
        }),
      });
      if (res.ok) {
        setName("");
        setUsername("");
        setPassword("");
        fetchColleagues();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteColleague = async (id: number) => {
    const msg = t.team.confirm_delete;
    if (!confirm(msg)) return;
    try {
      const simulatedUser = localStorage.getItem("sim_user");
      const currentUserName = simulatedUser ? JSON.parse(simulatedUser).name : "Admin (Simulated)";
      const currentUserUsername = simulatedUser ? JSON.parse(simulatedUser).username : "admin";

      const res = await fetch("/api/colleagues", {
        method: "DELETE",
        headers: { 
          "x-simulated-user": currentUserName,
          "x-simulated-username": currentUserUsername
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchColleagues();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-left">
        <h1 className="text-3xl font-bold tracking-tight">{t.team.title}</h1>
        <p className="text-muted-foreground">{t.team.subtitle}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="glass-card p-6 flex flex-col gap-4 h-fit sticky top-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus size={20} className="text-accent" /> {t.team.add_member}
          </h2>
          <form onSubmit={addColleague} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t.team.full_name}
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahmad Suhendar"
                  className="w-full bg-muted/50 border-none py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t.team.username}
              </label>
              <div className="relative group">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ahmad.s (auto-generated if empty)"
                  className="w-full bg-muted/50 border-none py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t.team.password}
              </label>
              <div className="relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for default"
                  className="w-full bg-muted/50 border-none py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t.team.role}
              </label>
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-muted/50 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm appearance-none cursor-pointer font-bold"
                >
                  <option value="USER">{t.team.role_user}</option>
                  <option value="ADMIN">{t.team.role_admin}</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
              </div>
            </div>

            <button
              disabled={isSubmitting || !name}
              className="premium-button flex items-center justify-center gap-2 disabled:opacity-50 py-4 font-bold mt-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus size={18} />}
              {t.team.invite}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-left flex items-center gap-2">
            {t.team.active_members} <span className="bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full">{colleagues.length}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading ? (
              <div className="col-span-full text-center p-12 text-muted-foreground italic">{t.team.loading}</div>
            ) : colleagues.length === 0 ? (
              <div className="col-span-full text-center p-12 border-2 border-dashed border-border rounded-3xl text-muted-foreground italic">
                {t.team.not_found}
              </div>
            ) : (
              colleagues.map((col: any) => (
                <div key={col.id} className="glass-card p-5 flex items-center gap-4 group transition-all hover:scale-[1.02] hover:-translate-y-1 shadow-lg hover:shadow-accent/5">
                  <div className={`p-4 rounded-2xl shrink-0 ${col.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                    {col.role === "ADMIN" ? <Shield size={32} /> : <User size={32} />}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0 text-left">
                    <span className="font-bold tracking-tight text-lg line-clamp-1 decoration-accent/50 hover:underline cursor-default" title={col.name}>{col.name}</span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-1.5 italic">
                        <AtSign size={10} className="text-accent"/> {col.username || "unset"} 
                        {JSON.parse(localStorage.getItem("sim_user") || "{}").id === col.id && (
                          <span className="bg-emerald-500/10 text-emerald-500 rounded lowercase text-[8px] border border-emerald-500/20 px-1 ml-1 font-black">You</span>
                        )}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-bold flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded-md ${col.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                          {col.role}
                        </span>
                        • {col._count.records} {t.team.tasks}
                      </span>
                    </div>
                  </div>
                  {JSON.parse(localStorage.getItem("sim_user") || "{}").id !== col.id && (
                    <button 
                      onClick={() => deleteColleague(col.id)}
                      className="p-3 shrink-0 transition-all hover:bg-rose-500/10 text-rose-500/40 hover:text-rose-500 rounded-xl"
                      title={language === "ID" ? "Hapus anggota" : "Remove member"}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
