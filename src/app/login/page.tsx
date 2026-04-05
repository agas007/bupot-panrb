"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Lock, User, LogIn, ShieldAlert, CheckCircle2, 
  ArrowRight, ShieldCheck, KeyRound, Loader2, Code
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function LoginPage() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("sim_user");
    if (savedUser) router.push("/");
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        localStorage.setItem("sim_user", JSON.stringify(data));
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      } else {
        setError(data.error || "Login Gagal. Silakan cek kembali username & password Anda.");
      }
    } catch (err) {
      setError("Kesalahan koneksi. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-9999 overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse delay-700" />
      
      <div className="w-full max-w-[420px] relative">
        <div className="glass-card p-10 rounded-[32px] border border-white/10 shadow-2xl backdrop-blur-3xl flex flex-col gap-8 animate-in zoom-in duration-500">
           <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 bg-accent/10 text-accent rounded-3xl scale-110 shadow-xl shadow-accent/10 border border-accent/20">
                 <ShieldCheck size={40} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1">
                 <h1 className="text-3xl font-black uppercase tracking-tight text-white/90 leading-none">Bupot PANRB</h1>
                 <p className="text-[10px] font-bold text-accent uppercase tracking-[0.3em] opacity-80 italic">Internal Management</p>
              </div>
           </div>

           <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Username / NIP</label>
                 <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent transition-colors" size={18} />
                    <input 
                       className="w-full bg-white/5 border border-white/5 hover:border-white/10 focus:border-accent/40 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-white transition-all outline-none focus:ring-4 focus:ring-accent/5"
                       placeholder="agastya.arnanda"
                       value={username}
                       onChange={e => setUsername(e.target.value)}
                       required
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Password System</label>
                 <div className="relative group">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent transition-colors" size={18} />
                    <input 
                       type="password"
                       className="w-full bg-white/5 border border-white/5 hover:border-white/10 focus:border-accent/40 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-white transition-all outline-none focus:ring-4 focus:ring-accent/5"
                       placeholder="••••••••••••"
                       value={password}
                       onChange={e => setPassword(e.target.value)}
                       required
                    />
                 </div>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs p-4 rounded-xl flex items-start gap-3 animate-shake overflow-hidden">
                   <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                   <span className="font-bold leading-relaxed wrap-break-word">{error}</span>
                </div>
              )}

              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                   <CheckCircle2 size={16} className="shrink-0" />
                   <span className="font-bold">Login Berhasil! Mengalihkan...</span>
                </div>
              )}

           <div className="flex flex-col gap-4">
              <button 
                disabled={isLoading || success}
                className={`premium-button w-full py-4.5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all
                ${success ? "bg-emerald-600 shadow-emerald-500/20" : ""}`}
              >
                 {isLoading ? (
                    <Loader2 className="animate-spin" size={20} />
                 ) : success ? (
                    <>Success <CheckCircle2 size={20} /></>
                 ) : (
                    <>Akses Dashboard <ArrowRight size={20} /></>
                 )}
              </button>

              <button 
                type="button"
                onClick={() => router.push("/api-docs")}
                className="w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-accent flex items-center justify-center gap-2 transition-all hover:bg-white/5 rounded-2xl"
              >
                  <Code size={14} /> Documentation API
              </button>
           </div>
           </form>

           <div className="flex flex-col items-center gap-1 opacity-20 hover:opacity-100 transition-opacity">
              <span className="text-[9px] font-bold text-white uppercase tracking-widest italic">Digital Security Layer v2.1</span>
              <p className="text-[8px] text-center text-white/60">Sistem ini hanya ditujukan untuk penggunaan internal Biro Umum dan Pengadaan PANRB.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
