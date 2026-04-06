"use client";

import { useState, useEffect } from "react";
import { User, KeyRound, Save, Loader2, ShieldCheck, CheckCircle2, UserPen, AtSign } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function SettingsPage() {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("sim_user");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setName(parsed.name);
    }
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/colleagues", {
        method: "PATCH",
        headers: { 
          "x-simulated-user": user.name,
          "x-simulated-username": user.username
        },
        body: JSON.stringify({ 
          id: user.id,
          name: name,
          password: password || undefined
        }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        // Update local storage to keep session in sync
        const newSession = { ...user, name: updatedUser.name };
        localStorage.setItem("sim_user", JSON.stringify(newSession));
        setUser(newSession);
        setSuccess(true);
        setPassword("");
        
        // Refresh page after a delay to update all UI references
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto py-10">
      <header className="flex flex-col gap-2 text-left">
        <h1 className="text-3xl font-bold tracking-tight">{language === "ID" ? "Pengaturan Profil" : "Profile Settings"}</h1>
        <p className="text-muted-foreground">{language === "ID" ? "Kelola informasi akun dan kata sandi Anda." : "Manage your account information and password."}</p>
      </header>

      <section className="glass-card p-10 flex flex-col gap-10">
        <div className="flex items-center gap-6">
           <div className={`p-6 rounded-3xl ${user.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"} border border-white/5 shadow-xl`}>
              <User size={48} />
           </div>
           <div className="flex flex-col text-left">
              <h2 className="text-2xl font-bold tracking-tight">{user.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                 <span className="text-xs font-black uppercase text-accent tracking-widest italic flex items-center gap-1.5 opacity-60">
                    <AtSign size={10} /> {user.username}
                 </span>
                 <span className="h-4 w-px bg-white/10" />
                 <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${user.role === "ADMIN" ? "bg-accent text-white" : "bg-primary text-white"}`}>
                    {user.role} MODE
                 </span>
              </div>
           </div>
        </div>

        <form onSubmit={handleUpdate} className="flex flex-col gap-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-2 text-left">
                 <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t.team.full_name}</label>
                 <div className="relative group">
                    <UserPen className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={18} />
                    <input 
                      className="w-full bg-muted/50 border-none py-4.5 pl-12 pr-4 rounded-2xl outline-none focus:ring-4 focus:ring-accent/5 transition-all text-sm font-bold"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-2 text-left">
                 <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{language === "ID" ? "Ganti Password (Isi jika ingin ubah)" : "Change Password (Fill to update)"}</label>
                 <div className="relative group">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={18} />
                    <input 
                      type="password"
                      className="w-full bg-muted/50 border-none py-4.5 pl-12 pr-4 rounded-2xl outline-none focus:ring-4 focus:ring-accent/5 transition-all text-sm font-bold"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                 </div>
              </div>
           </div>

           {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-center gap-4 text-emerald-500 animate-in fade-in zoom-in duration-300">
                 <CheckCircle2 size={24} />
                 <div className="flex flex-col text-left">
                    <span className="font-bold">{language === "ID" ? "Pembaruan Berhasil!" : "Update Successful!"}</span>
                    <span className="text-xs opacity-80">{language === "ID" ? "Informasi profil Anda telah diperbarui secara aman." : "Your profile information has been securely updated."}</span>
                 </div>
              </div>
           )}

           <button 
             disabled={isSubmitting || !name}
             className="premium-button py-5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 group active:scale-95 transition-all"
           >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} className="group-hover:scale-110 transition-transform" />}
              {language === "ID" ? "Simpan Perubahan Profil" : "Save Profile Changes"}
           </button>
        </form>

        <div className="border-t border-white/5 pt-8 flex flex-col items-center gap-2 opacity-30">
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={14} className="text-accent" /> Optimized Security Pipeline v2.1
           </div>
           <p className="text-[9px] text-center max-w-sm">Dukungan teknis tersedia melalui Administrator Biro Umum jika Anda kehilangan akses akun.</p>
        </div>
      </section>
    </div>
  );
}
