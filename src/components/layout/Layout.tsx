"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Users, 
  Settings, 
  LogIn, 
  X,
  Shield,
  User as UserIcon,
  CircleCheck,
  Sparkles,
  Info,
  Check,
  Sun,
  Moon,
  Languages,
  Clock,
  History,
  ChevronLeft,
  ChevronRight,
  Menu,
  Globe,
  LogOut,
  Code,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  KeyRound,
  ShieldCheck,
  AtSign,
  Settings2,
  Bell,
  CheckCircle2,
  AlertCircle,
  FileType
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface Colleague {
  id: number;
  name: string;
  role: string;
  username: string;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementTab, setAnnouncementTab] = useState<"v1.2.0" | "v1.1.0">("v1.2.0");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [currentUser, setCurrentUser] = useState<Colleague | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 🔥 NEW: Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const MODAL_VERSION = "1.2.0";

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/notifications", {
        headers: {
          "x-simulated-username": currentUser.username
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [currentUser]);

  const markAsRead = async (id?: number, all: boolean = false) => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "x-simulated-username": currentUser.username,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, all })
      });
      if (res.ok) fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  useEffect(() => {
    setMounted(true);
    
    if (typeof window !== "undefined") {
      const lastSeen = localStorage.getItem("bupot_announcement_seen");
      if (lastSeen !== MODAL_VERSION) {
        setTimeout(() => setShowAnnouncement(true), 1000);
      }

      const savedTheme = localStorage.getItem("bupot_theme") as "light" | "dark" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      }

      const savedCollapsed = localStorage.getItem("bupot_sidebar_collapsed");
      if (savedCollapsed === "true") {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("sim_user");
    const isPublicRoute = pathname === "/login" || pathname === "/api-docs";
    
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else if (mounted && !isPublicRoute) {
      router.push("/login");
    }
  }, [mounted, pathname, router]);

  // Periodic notifications fetch
  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000); // 1 minute
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchNotifications]);

  const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 Minutes

  useEffect(() => {
    if (!currentUser) return;

    let logoutTimer: NodeJS.Timeout;

    const resetTimer = () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        console.log("[Security] User inactive for 5 minutes. Logging out...");
        handleLogout();
      }, INACTIVITY_LIMIT);
    };

    // Events to track activity
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [currentUser, pathname]);
  
  const handleLogout = async () => {
    try {
      if (currentUser) {
        await fetch("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ username: currentUser.username }),
        });
      }
    } catch (err) {
      console.error("Logout log error:", err);
    }
    localStorage.removeItem("sim_user");
    setCurrentUser(null);
    router.push("/login");
  };

  const toggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      const newState = !isSidebarCollapsed;
      setIsSidebarCollapsed(newState);
      localStorage.setItem("bupot_sidebar_collapsed", String(newState));
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("bupot_theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  useEffect(() => {
    const protectedRoutes = ["/colleagues", "/admin", "/logs"];
    if (mounted && currentUser?.role === "USER" && protectedRoutes.includes(pathname)) {
      router.push("/");
    }
  }, [pathname, currentUser, mounted, router]);

  const filteredNavItems = [
    { href: "/", label: t.nav.beranda, icon: LayoutDashboard, minRole: "USER" },
    { href: "/records", label: t.nav.lembar_kerja, icon: FileSpreadsheet, minRole: "USER" },
    { href: "/colleagues", label: t.nav.daftar_rekan, icon: Users, minRole: "ADMIN" },
    { href: "/logs", label: t.nav.log_aktivitas || "Log Aktivitas", icon: History, minRole: "ADMIN" },
    { href: "/api-docs", label: t.nav.dokumentasi_api || "API Docs", icon: FileText },
    { href: "/admin", label: t.nav.panel_admin, icon: Settings, minRole: "ADMIN" },
    { href: "/settings", label: t.nav.pengaturan || "Settings", icon: Settings2, minRole: "USER" },
  ].filter(item => {
    if (item.minRole === "ADMIN") return currentUser?.role === "ADMIN";
    if (item.minRole === "USER") return currentUser !== null;
    return true;
  });

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 glass-card rounded-none! z-100 flex items-center justify-between px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="bg-accent text-accent-foreground p-2 rounded-xl">
            <FileSpreadsheet size={20} />
          </div>
          <span className="font-bold text-sm tracking-tight">Bupot PANRB</span>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowNotifications(!showNotifications)}
             className="p-3 bg-muted/50 rounded-2xl relative"
           >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background animate-bounce shadow-lg">
                  {unreadCount}
                </span>
              )}
           </button>
           <button 
             onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
             className="p-3 bg-accent text-accent-foreground rounded-2xl shadow-lg active:scale-95 transition-all"
           >
             {isMobileMenuOpen ? <X size={20} /> : <PanelLeftOpen size={20} />}
           </button>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-110" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* 🔥 NEW: Global Header Toolbar (Only for Desktop) */}
      <div className="hidden lg:flex fixed top-4 right-4 z-100 items-center gap-4">
          <div className="relative">
             <button 
               onClick={() => setShowNotifications(!showNotifications)}
               className={`p-3 glass-card rounded-2xl relative transition-all hover:scale-105 active:scale-95 overflow-visible! ${showNotifications ? "bg-accent/20 border-accent/40" : "hover:bg-white/10"}`}
             >
                <Bell size={20} className={unreadCount > 0 ? "animate-swing origin-top" : ""} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background shadow-lg">
                    {unreadCount}
                  </span>
                )}
             </button>

             {showNotifications && (
               <div className="absolute right-0 mt-4 w-96 glass-card p-6 z-200 shadow-2xl animate-in fade-in slide-in-from-top-4 border-accent/20 max-h-[80vh] flex flex-col gap-6">
                  <div className="flex justify-between items-center bg-accent/5 p-2 rounded-2xl border border-accent/10">
                     <div className="flex items-center gap-3 px-2">
                        <div className="p-2 bg-accent/10 text-accent rounded-xl"><Bell size={20} /></div>
                        <h3 className="font-black text-sm uppercase tracking-widest">{language === "ID" ? "Notifikasi" : "Notifications"}</h3>
                     </div>
                     <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3 min-h-[100px] max-h-[400px]">
                     {notifications.length === 0 ? (
                       <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3 opacity-50">
                          <CheckCircle2 size={40} />
                          <p className="text-[10px] font-black uppercase tracking-widest">{language === "ID" ? "Tidak ada notifikasi" : "No Notifications"}</p>
                       </div>
                     ) : (
                       notifications.map(n => (
                         <div 
                           key={n.id} 
                           className={`p-4 rounded-2xl border transition-all text-left flex gap-4 ${n.isRead ? "bg-white/5 border-white/5 opacity-60" : "bg-accent/5 border-accent/20 hover:bg-accent/10 hover:-translate-y-0.5"}`}
                           onClick={() => markAsRead(n.id)}
                         >
                            <div className={`p-2 rounded-xl mt-1 shrink-0 ${n.type === "WARNING" ? "bg-amber-500/10 text-amber-500" : "bg-accent/10 text-accent"}`}>
                               {n.type === "WARNING" ? <AlertCircle size={16}/> : <Info size={16}/>}
                            </div>
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                               <div className="flex justify-between items-start">
                                  <span className="text-xs font-black tracking-tight leading-none text-foreground uppercase">{n.title}</span>
                                  <span className="text-[8px] font-bold text-muted-foreground whitespace-nowrap">{new Date(n.createdAt).toLocaleDateString()}</span>
                               </div>
                               <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-3">{n.message}</p>
                               {!n.isRead && (
                                 <button className="text-[9px] font-black uppercase tracking-widest text-accent hover:underline mt-1 text-left">
                                   {language === "ID" ? "Tandai dibaca" : "Mark as read"}
                                 </button>
                               )}
                            </div>
                         </div>
                       ))
                     )}
                  </div>

                  {unreadCount > 0 && (
                    <button 
                      onClick={() => markAsRead(undefined, true)}
                      className="premium-button py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 group shadow-xl"
                    >
                       <Check size={16} className="group-hover:scale-110 transition-transform" />
                       {language === "ID" ? "Baca Semua" : "Read All"}
                    </button>
                  )}
               </div>
             )}
          </div>
      </div>

      <aside className={`
        fixed left-0 top-0 h-full z-120 lg:z-50 transition-all duration-500 ease-in-out flex flex-col p-4 gap-6
        ${isMobileMenuOpen ? "translate-x-0 w-[280px]" : "-translate-x-full w-[280px] lg:translate-x-0"} 
        ${isSidebarCollapsed ? "lg:w-22" : "lg:w-60"}
        glass-card overflow-visible! lg:h-[calc(100vh-2rem)] lg:m-4
      `}>
        <button 
          onClick={toggleSidebar}
          className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground p-2 rounded-full shadow-xl hover:scale-110 transition-all z-60 border-2 border-background"
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        <div className={`flex items-center gap-3 px-2 py-2 overflow-hidden ${isSidebarCollapsed ? "justify-center" : ""}`}>
          <div className="bg-accent text-accent-foreground p-2 rounded-xl shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-4 text-left">
              <span className="font-bold text-lg tracking-tight leading-none mb-1">Bupot PANRB</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Internal System</span>
            </div>
          )}
        </div>

        <Link 
          href="/settings"
          className={`bg-muted/50 p-3 rounded-xl flex items-center gap-3 overflow-hidden transition-all hover:bg-accent/10 active:scale-95 group ${isSidebarCollapsed ? "justify-center" : ""}`}
        >
          <div className={`p-2 rounded-lg shrink-0 transition-transform group-hover:scale-110 ${currentUser?.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
            {currentUser?.role === "ADMIN" ? <Shield size={18} /> : <UserIcon size={18} />}
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left-4 text-left">
              <span className="text-xs font-bold truncate group-hover:text-accent transition-colors">{currentUser?.name || "Visitor"}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{currentUser?.role || "GUEST"} MODE</span>
            </div>
          )}
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? (theme === "dark" 
                        ? "bg-primary text-primary-foreground shadow-lg" 
                        : "bg-accent/10 text-accent shadow-sm ring-1 ring-accent/20") 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                } ${isSidebarCollapsed ? "justify-center" : ""}`}
              >
                <Icon size={20} className="shrink-0" />
                {!isSidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4 px-2 flex flex-col gap-1 overflow-hidden">
          <div className={`flex flex-wrap items-center gap-1 ${isSidebarCollapsed ? "flex-col" : "flex-row"}`}>
            <button onClick={() => setShowAnnouncement(true)} className="flex-1 flex items-center gap-2 text-foreground/60 hover:text-accent dark:text-muted-foreground p-2 rounded-lg hover:bg-accent/5 justify-center transition-colors" title={t.nav.fitur_baru}>
              <Sparkles size={16} />
              {!isSidebarCollapsed && <span className="font-medium text-[11px] uppercase tracking-wider">{t.nav.fitur_baru}</span>}
            </button>
            <button onClick={toggleTheme} className="flex-1 flex items-center gap-2 text-foreground/60 hover:text-foreground dark:text-muted-foreground p-2 rounded-lg hover:bg-muted justify-center transition-colors">
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              {!isSidebarCollapsed && <span className="font-medium text-[11px] uppercase tracking-wider">{theme === "light" ? t.nav.mode_gelap : t.nav.mode_terang}</span>}
            </button>
            <button onClick={() => setLanguage(language === "ID" ? "EN" : "ID")} className="flex-1 flex items-center gap-2 text-foreground/60 hover:text-foreground dark:text-muted-foreground p-2 rounded-lg hover:bg-muted justify-center transition-colors" title={t.nav.ganti_bahasa}>
              <Languages size={16} />
              {!isSidebarCollapsed && <span className="font-medium text-[11px] uppercase tracking-wider">{language}</span>}
            </button>
          </div>
          
          <button onClick={handleLogout} className={`w-full flex items-center gap-3 text-muted-foreground hover:text-rose-500 cursor-pointer transition-colors p-2 rounded-lg hover:bg-rose-500/5 group ${isSidebarCollapsed ? "justify-center" : ""}`}>
             <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
             {!isSidebarCollapsed && <span className="font-medium text-sm">Keluar / Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 p-4 pt-24 lg:pt-12 transition-all duration-500 ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <div className="container max-w-full">{children}</div>
      </main>

      {/* Modern Announcement Modal v1.2.0 */}
      {showAnnouncement && mounted && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-9999 flex items-center justify-center p-4">
            <div className="glass-card bg-slate-900/95! border-white/10! w-full max-w-xl p-8 flex flex-col gap-8 shadow-2xl animate-in zoom-in duration-300">
               <div className="flex justify-between items-center text-left">
                  <div className="flex items-center gap-4">
                     <div className="bg-accent/20 text-accent p-3 rounded-2xl animate-pulse">
                        <Sparkles size={32} />
                     </div>
                     <div className="flex flex-col">
                        <h2 className="text-2xl font-black uppercase tracking-tight text-white">Rilis v1.2.0 Stabil</h2>
                        <span className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">Security & Authentication Update</span>
                     </div>
                  </div>
                  <button onClick={() => setShowAnnouncement(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white"><X size={24}/></button>
               </div>
               
               <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                  <button onClick={() => setAnnouncementTab("v1.2.0")} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${announcementTab === "v1.2.0" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-white/40"}`}>LATEST v1.2.0</button>
                  <button onClick={() => setAnnouncementTab("v1.1.0")} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${announcementTab === "v1.1.0" ? "bg-white/20 text-white" : "text-white/40"}`}>PREVIOUS v1.1.0</button>
               </div>

               {announcementTab === "v1.2.0" ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                   <div className="flex gap-3 items-start p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                      <ShieldCheck className="text-emerald-400 shrink-0 mt-1" size={18} />
                      <div className="flex flex-col gap-1">
                         <span className="text-xs font-bold text-white leading-none">Login Berbasis Kredensial</span>
                         <p className="text-[11px] text-white/50 leading-relaxed">Sistem kini mewajibkan login dengan Username & Password resmi untuk keamanan data.</p>
                      </div>
                   </div>
                   <div className="flex gap-3 items-start p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                      <Bell className="text-indigo-400 shrink-0 mt-1" size={18} />
                      <div className="flex flex-col gap-1">
                         <span className="text-xs font-bold text-white leading-none">Notifikasi In-App</span>
                         <p className="text-[11px] text-white/50 leading-relaxed">Terima pemberitahuan tugas baru dan pengingat deadline langsung di aplikasi.</p>
                      </div>
                   </div>
                   <div className="flex gap-3 items-start p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                      <History className="text-amber-400 shrink-0 mt-1" size={18} />
                      <div className="flex flex-col gap-1">
                         <span className="text-xs font-bold text-white leading-none">Audit Aktivitas Sesi</span>
                         <p className="text-[11px] text-white/50 leading-relaxed">Semua riwayat login, logout, dan percobaan masuk tidak sah kini tercatat di Log Aktivitas.</p>
                      </div>
                   </div>
                   <div className="flex gap-3 items-start p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                      <FileType className="text-rose-400 shrink-0 mt-1" size={18} />
                      <div className="flex flex-col gap-1">
                         <span className="text-xs font-bold text-white leading-none">Multi-Format Export</span>
                         <p className="text-[11px] text-white/50 leading-relaxed">Ekspor laporan lembar kerja kini tersedia dalam format PDF, Excel, dan CSV.</p>
                      </div>
                   </div>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                   <div className="flex gap-3 items-start p-4 bg-white/5 rounded-2xl border border-white/10">
                      <Languages className="text-sky-400 shrink-0 mt-1" size={18} />
                      <div className="flex flex-col gap-1">
                         <span className="text-xs font-bold text-white leading-none">Bilingual Support</span>
                         <p className="text-[11px] text-white/50 leading-relaxed">Dukungan penuh Bahasa Indonesia & English di seluruh modul aplikasi.</p>
                      </div>
                   </div>
                   <div className="flex gap-3 items-start p-4 bg-white/5 rounded-2xl border border-white/10">
                      <Moon className="text-indigo-400 shrink-0 mt-1" size={18} />
                      <div className="flex flex-col gap-1">
                         <span className="text-xs font-bold text-white leading-none">Premium Dark Mode</span>
                         <p className="text-[11px] text-white/50 leading-relaxed">Pengalaman visual yang lebih nyaman untuk penggunaan durasi panjang.</p>
                      </div>
                   </div>
                 </div>
               )}

               <button onClick={() => { setShowAnnouncement(false); localStorage.setItem("bupot_announcement_seen", MODAL_VERSION); }} className="premium-button py-4 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3">
                  SIAP, GUNAKAN SEKARANG! <Check size={20} />
               </button>
            </div>
         </div>
      )}
    </div>
  );
}
