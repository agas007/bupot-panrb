"use client";

import { useEffect, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Search
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface Colleague {
  id: number;
  name: string;
  role: string;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementTab, setAnnouncementTab] = useState<"v1.1.0" | "v1.0.0">("v1.1.0");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [currentUser, setCurrentUser] = useState<Colleague | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const MODAL_VERSION = "1.1.0";

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

    const savedUser = localStorage.getItem("sim_user");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const fetchColleagues = async () => {
    try {
      const res = await fetch("/api/colleagues");
      const data = await res.json();
      setColleagues(data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem("bupot_sidebar_collapsed", String(newState));
  };

  const handleSwitchUser = (user: Colleague | null) => {
    if (user) {
      localStorage.setItem("sim_user", JSON.stringify(user));
      setCurrentUser(user);
    } else {
      localStorage.removeItem("sim_user");
      setCurrentUser(null);
    }
    setShowSwitchModal(false);
    
    if (user?.role === "USER" && (pathname === "/colleagues" || pathname === "/admin")) {
      router.push("/");
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("bupot_theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  useEffect(() => {
    if (showSwitchModal) fetchColleagues();
  }, [showSwitchModal]);

  useEffect(() => {
    if (mounted && currentUser?.role === "USER" && (pathname === "/colleagues" || pathname === "/admin")) {
      router.push("/");
    }
  }, [pathname, currentUser, mounted, router]);

  const filteredNavItems = [
    { href: "/", label: t.nav.beranda, icon: LayoutDashboard, minRole: "USER" },
    { href: "/records", label: t.nav.lembar_kerja, icon: FileSpreadsheet, minRole: "USER" },
    { href: "/colleagues", label: t.nav.daftar_rekan, icon: Users, minRole: "ADMIN" },
    { href: "/admin", label: t.nav.panel_admin, icon: Settings, minRole: "ADMIN" },
  ].filter(item => {
    if (item.minRole === "ADMIN") return currentUser?.role === "ADMIN";
    return true;
  });

  return (
    <div className="flex min-h-screen">
      <aside className={`${isSidebarCollapsed ? "w-20" : "w-64"} glass-card !overflow-visible fixed h-[calc(100vh-2rem)] m-4 flex flex-col p-4 gap-6 z-50 transition-all duration-300 ease-in-out`}>
        {/* Toggle Button */}
        <button 
          onClick={toggleSidebar}
          className="absolute -right-4 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground p-2 rounded-full shadow-xl hover:scale-110 transition-all z-[60] border-2 border-background"
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        {/* Logo/Brand */}
        <div className={`flex items-center gap-3 px-2 py-2 overflow-hidden ${isSidebarCollapsed ? "justify-center" : ""}`}>
          <div className="bg-accent text-accent-foreground p-2 rounded-xl shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-300">
              <span suppressHydrationWarning className="font-bold text-lg tracking-tight leading-none mb-1">
                Bupot PANRB
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Internal System
              </span>
            </div>
          )}
        </div>

        {/* User Context */}
        <div className={`bg-muted/50 p-3 rounded-xl flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? "justify-center" : ""}`}>
          <div className={`p-2 rounded-lg shrink-0 ${currentUser?.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
            {currentUser?.role === "ADMIN" ? <Shield size={18} /> : <UserIcon size={18} />}
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left-4 duration-300">
              <span className="text-xs font-bold truncate">{currentUser?.name || "Visitor (Unset)"}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{currentUser?.role || "GUEST"} MODE</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                } ${isSidebarCollapsed ? "justify-center" : ""}`}
              >
                <Icon size={20} className="shrink-0" />
                {!isSidebarCollapsed && <span className="font-medium animate-in fade-in slide-in-from-left-4 duration-300">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="mt-auto border-t border-border pt-4 px-2 flex flex-col gap-1 text-left overflow-hidden">
          <div className={`flex items-center gap-1 ${isSidebarCollapsed ? "flex-col" : "flex-row"}`}>
            <button 
              onClick={toggleTheme}
              title={isSidebarCollapsed ? (theme === "light" ? t.nav.mode_gelap : t.nav.mode_terang) : undefined}
              className="flex-1 flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-2 rounded-lg hover:bg-muted justify-center"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              {!isSidebarCollapsed && <span className="font-medium text-[11px] uppercase tracking-wider animate-in fade-in slide-in-from-left-4 duration-300">{theme === "light" ? t.nav.mode_gelap : t.nav.mode_terang}</span>}
            </button>
            <button 
              onClick={() => setLanguage(language === "ID" ? "EN" : "ID")}
              title={isSidebarCollapsed ? t.nav.ganti_bahasa : undefined}
              className="flex-1 flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-2 rounded-lg hover:bg-muted justify-center"
            >
              <Languages size={16} />
              {!isSidebarCollapsed && <span className="font-medium text-[11px] uppercase tracking-wider text-center flex-1 animate-in fade-in slide-in-from-left-4 duration-300">{language}</span>}
            </button>
          </div>

          <button 
            onClick={() => setShowAnnouncement(true)}
            title={isSidebarCollapsed ? t.nav.fitur_baru : undefined}
            className={`w-full flex items-center gap-3 text-muted-foreground hover:text-accent cursor-pointer transition-colors p-2 rounded-lg hover:bg-accent/5 group ${isSidebarCollapsed ? "justify-center" : ""}`}
          >
            <Sparkles size={18} className="group-hover:animate-pulse shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium text-sm animate-in fade-in slide-in-from-left-4 duration-300">{t.nav.fitur_baru}</span>}
          </button>
          
          <button 
            onClick={() => setShowSwitchModal(true)}
            title={isSidebarCollapsed ? t.nav.ganti_pengguna : undefined}
            className={`w-full flex items-center gap-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-2 rounded-lg hover:bg-muted ${isSidebarCollapsed ? "justify-center" : ""}`}
          >
            <LogIn size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium text-sm animate-in fade-in slide-in-from-left-4 duration-300">{t.nav.ganti_pengguna}</span>}
          </button>
        </div>
      </aside>

      {/* Announcements Modal */}
      {showAnnouncement && mounted && (
        <div className="bg-overlay flex items-center justify-center p-4 z-[9999]">
          <div className="glass-card w-full max-w-xl p-8 flex flex-col gap-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="bg-accent/20 text-accent p-3 rounded-2xl animate-bounce">
                  <Sparkles size={32} />
                </div>
                <div className="flex flex-col text-left">
                  <h2 className="text-2xl font-bold text-white tracking-tight uppercase">
                    {announcementTab === "v1.1.0" ? "Rilis v1.1.0 Stabil" : "Rilis v1.0.0 Stabil"}
                  </h2>
                  <span className="text-accent text-xs font-bold tracking-widest uppercase">
                    {announcementTab === "v1.1.0" ? "New Features & Localization" : "Initial Stable Launch"}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAnnouncement(false);
                  localStorage.setItem("bupot_announcement_seen", MODAL_VERSION);
                }}
                className="text-white/40 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
              <button 
                onClick={() => setAnnouncementTab("v1.1.0")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${announcementTab === "v1.1.0" ? "bg-accent text-accent-foreground shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                LATEST v1.1.0
              </button>
              <button 
                onClick={() => setAnnouncementTab("v1.0.0")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${announcementTab === "v1.0.0" ? "bg-white/20 text-white" : "text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                PREVIOUS v1.0.0
              </button>
            </div>

            {announcementTab === "v1.1.0" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center gap-3 mb-2 text-indigo-400">
                    <Moon size={18} />
                    <span className="text-sm font-bold">{language === "ID" ? "Mode Gelap Premium" : "Premium Dark Mode"}</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white/90 transition-colors">
                    {language === "ID" ? "Bekerja lembur jadi lebih nyaman dengan tampilan mode gelap yang elegan." : "Work late comfortably with our elegant and eye-pleasing dark theme."}
                  </p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center gap-3 mb-2 text-emerald-400">
                    <Languages size={18} />
                    <span className="text-sm font-bold">{language === "ID" ? "Dukungan Dua Bahasa" : "Bilingual Support"}</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white/90 transition-colors">
                    {language === "ID" ? "Bisa ganti antara Bahasa Indonesia & English langsung dari sidebar." : "Switch seamlessly between Indonesian and English directly from the sidebar."}
                  </p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center gap-3 mb-2 text-amber-400">
                    <History size={18} />
                    <span className="text-sm font-bold">{language === "ID" ? "Urutan Masa Pajak" : "Chronological Period"}</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white/90 transition-colors">
                    {language === "ID" ? "Dashboard kini otomatis mengurutkan data berdasarkan Masa Pajak SP2D." : "Dashboard now automatically sorts data based on SP2D Tax Period."}
                  </p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center gap-3 mb-2 text-purple-400">
                    <Clock size={18} />
                    <span className="text-sm font-bold">{language === "ID" ? "Log Catatan Audit" : "Audit Note Logging"}</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white/90 transition-colors">
                    {language === "ID" ? "Sertakan catatan tambahan dan link bukti pendukung untuk audit tim." : "Keep track of task completion with supporting documents and custom notes."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center gap-3 mb-2 text-accent">
                    <FileSpreadsheet size={18} />
                    <span className="text-sm font-bold">Integrated Excel Hub</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white/90 transition-colors">
                    Automatic merge of "Monitoring Potongan SPM" & "SPP" in one smart upload.
                  </p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center gap-3 mb-2 text-blue-400">
                    <LayoutDashboard size={18} />
                    <span className="text-sm font-bold">Pro Dashboard</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white/90 transition-colors">
                    Real-time monitoring of team compliance and individual task load.
                  </p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center gap-3 mb-2 text-amber-400">
                    <Search size={18} />
                    <span className="text-sm font-bold">Smart Filters v1.0</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white/90 transition-colors">
                    Filter by Accounts, Multi-sort, and Search by All Amounts.
                  </p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center gap-3 mb-2 text-zinc-400">
                    <Users size={18} />
                    <span className="text-sm font-bold">Simulation Mode</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white/90 transition-colors">
                    Switch between colleague perspectives to verify workflow integrity.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 text-left">
              <div className="flex items-center gap-3 px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl text-accent text-xs">
                <Info size={16} />
                <span>Tips: {language === "ID" ? "Klik tab di atas buat liat sejarah rilis fitur." : "Click the tabs above to view feature release history."}</span>
              </div>
              <button 
                onClick={() => {
                  setShowAnnouncement(false);
                  localStorage.setItem("bupot_announcement_seen", MODAL_VERSION);
                }}
                className="premium-button py-4 font-bold flex items-center justify-center gap-3 group"
              >
                {language === "ID" ? "SIAP, GUNAKAN SEKARANG!" : "READY TO USE!"} <Check size={20} className="group-hover:scale-125 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch User Modal */}
      {showSwitchModal && (
        <div className="bg-overlay flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 flex flex-col gap-6 shadow-2xl animate-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <LogIn className="text-accent" /> {t.nav.ganti_pengguna}
              </h2>
              <button 
                onClick={() => setShowSwitchModal(false)}
                className="p-1.5 text-white hover:bg-white/20 rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground text-left">
              {language === "ID" ? "Pilih rekan kerja untuk simulasikan akun mereka di sistem." : "Select a colleague to simulate their perspective in the system."}
            </p>

            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto px-1">
              {colleagues.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleSwitchUser(col)}
                  className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all group ${
                    currentUser?.id === col.id 
                    ? "border-accent bg-white shadow-lg scale-[1.02]" 
                    : "border-transparent bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${col.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                       {col.role === "ADMIN" ? <Shield size={18} /> : <UserIcon size={18} />}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className={`font-bold text-sm ${currentUser?.id === col.id ? "text-slate-900" : ""}`}>{col.name}</span>
                      <span className={`text-[10px] uppercase tracking-widest ${currentUser?.id === col.id ? "text-accent font-semibold" : "text-white/40"}`}>{col.role}</span>
                    </div>
                  </div>
                  {currentUser?.id === col.id && <CircleCheck size={18} className="text-accent" />}
                </button>
              ))}
            </div>

            <button 
              onClick={() => handleSwitchUser(null)}
              className="premium-button text-sm w-full py-2.5 flex items-center justify-center gap-2"
            >
              {language === "ID" ? "Reset ke Mode Tamu / Visitor" : "Reset to Guest / Visitor Mode"}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 p-8 pt-12 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? "ml-24" : "ml-72"}`}>
        <div className="container max-w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
