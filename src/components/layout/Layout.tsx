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
  Menu,
  Globe,
  LogOut,
  Code,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Search
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface Colleague {
  id: number;
  name: string;
  role: string;
  username: string;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementTab, setAnnouncementTab] = useState<"v1.1.0" | "v1.0.0">("v1.1.0");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [currentUser, setCurrentUser] = useState<Colleague | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  ].filter(item => {
    if (item.minRole === "ADMIN") return currentUser?.role === "ADMIN";
    if (item.minRole === "USER") return currentUser !== null;
    return true;
  });

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 glass-card !rounded-none z-[100] flex items-center justify-between px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="bg-accent text-accent-foreground p-2 rounded-xl">
            <FileSpreadsheet size={20} />
          </div>
          <span className="font-bold text-sm tracking-tight">Bupot PANRB</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-accent text-accent-foreground rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          {isMobileMenuOpen ? <X size={20} /> : <PanelLeftOpen size={20} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`
        fixed left-0 top-0 h-full z-[120] lg:z-50 transition-all duration-500 ease-in-out flex flex-col p-4 gap-6
        ${isMobileMenuOpen ? "translate-x-0 w-[280px]" : "-translate-x-full w-[280px] lg:translate-x-0"} 
        ${isSidebarCollapsed ? "lg:w-22" : "lg:w-60"}
        glass-card !overflow-visible lg:h-[calc(100vh-2rem)] lg:m-4
      `}>
        <button 
          onClick={toggleSidebar}
          className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground p-2 rounded-full shadow-xl hover:scale-110 transition-all z-[60] border-2 border-background"
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        <div className={`flex items-center gap-3 px-2 py-2 overflow-hidden ${isSidebarCollapsed ? "justify-center" : ""}`}>
          <div className="bg-accent text-accent-foreground p-2 rounded-xl shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-4">
              <span className="font-bold text-lg tracking-tight leading-none mb-1">Bupot PANRB</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Internal System</span>
            </div>
          )}
        </div>

        <div className={`bg-muted/50 p-3 rounded-xl flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? "justify-center" : ""}`}>
          <div className={`p-2 rounded-lg shrink-0 ${currentUser?.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
            {currentUser?.role === "ADMIN" ? <Shield size={18} /> : <UserIcon size={18} />}
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left-4">
              <span className="text-xs font-bold truncate">{currentUser?.name || "Visitor"}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{currentUser?.role || "GUEST"} MODE</span>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                } ${isSidebarCollapsed ? "justify-center" : ""}`}
              >
                <Icon size={20} className="shrink-0" />
                {!isSidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4 px-2 flex flex-col gap-1 overflow-hidden">
          <div className={`flex items-center gap-1 ${isSidebarCollapsed ? "flex-col" : "flex-row"}`}>
            <button onClick={toggleTheme} className="flex-1 flex items-center gap-2 text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted justify-center transition-colors">
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              {!isSidebarCollapsed && <span className="font-medium text-[11px] uppercase tracking-wider">{theme === "light" ? t.nav.mode_gelap : t.nav.mode_terang}</span>}
            </button>
            <button onClick={() => setLanguage(language === "ID" ? "EN" : "ID")} className="flex-1 flex items-center gap-2 text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted justify-center transition-colors">
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

      {/* Fast Announcement Rendering */}
      {showAnnouncement && mounted && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-xl p-8 flex flex-col gap-8 shadow-2xl animate-in zoom-in">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                     <div className="bg-accent/20 text-accent p-3 rounded-2xl"><Sparkles size={32} /></div>
                     <h2 className="text-2xl font-bold uppercase">{announcementTab === "v1.1.0" ? "Rilis v1.1.0" : "Rilis v1.0.0"}</h2>
                  </div>
                  <button onClick={() => setShowAnnouncement(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
               </div>
               <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                  <button onClick={() => setAnnouncementTab("v1.1.0")} className={`flex-1 py-2 text-xs font-bold rounded-lg ${announcementTab === "v1.1.0" ? "bg-accent text-white" : "text-white/40"}`}>LATEST</button>
                  <button onClick={() => setAnnouncementTab("v1.0.0")} className={`flex-1 py-2 text-xs font-bold rounded-lg ${announcementTab === "v1.0.0" ? "bg-white/20" : "text-white/40"}`}>OLDER</button>
               </div>
               <button onClick={() => { setShowAnnouncement(false); localStorage.setItem("bupot_announcement_seen", MODAL_VERSION); }} className="premium-button py-4 font-bold uppercase tracking-widest">OK, GUNAKAN!</button>
            </div>
         </div>
      )}
    </div>
  );
}
