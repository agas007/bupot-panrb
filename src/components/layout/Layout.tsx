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
  CircleCheck
} from "lucide-react";

interface Colleague {
  id: number;
  name: string;
  role: string;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, minRole: "USER" },
  { href: "/records", label: "Worksheet", icon: FileSpreadsheet, minRole: "USER" },
  { href: "/colleagues", label: "Colleagues", icon: Users, minRole: "ADMIN" },
  { href: "/admin", label: "Admin Panel", icon: Settings, minRole: "ADMIN" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [currentUser, setCurrentUser] = useState<Colleague | null>(null);

  useEffect(() => {
    setMounted(true);
    // Load simulation user from localStorage
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

  const handleSwitchUser = (user: Colleague | null) => {
    if (user) {
      localStorage.setItem("sim_user", JSON.stringify(user));
      setCurrentUser(user);
    } else {
      localStorage.removeItem("sim_user");
      setCurrentUser(null);
    }
    setShowSwitchModal(false);
    
    // Redirect if on restricted page
    if (user?.role === "USER" && (pathname === "/colleagues" || pathname === "/admin")) {
      router.push("/");
    }
  };

  useEffect(() => {
    if (showSwitchModal) fetchColleagues();
  }, [showSwitchModal]);

  // Block access if restricted
  useEffect(() => {
    if (mounted && currentUser?.role === "USER" && (pathname === "/colleagues" || pathname === "/admin")) {
      router.push("/");
    }
  }, [pathname, currentUser, mounted, router]);

  const filteredNavItems = navItems.filter(item => {
    if (item.minRole === "ADMIN") return currentUser?.role === "ADMIN";
    return true;
  });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 glass-card fixed h-[calc(100vh-2rem)] m-4 flex flex-col p-4 gap-6 z-50">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="bg-accent text-accent-foreground p-2 rounded-xl">
            <FileSpreadsheet size={24} />
          </div>
          <div className="flex flex-col">
            <span suppressHydrationWarning className="font-bold text-lg tracking-tight leading-none mb-1">
              Bupot PANRB
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Internal System
            </span>
          </div>
        </div>

        {/* Current User Info */}
        <div className="bg-muted/50 p-3 rounded-xl flex items-center gap-3">
          <div className={`p-2 rounded-lg ${currentUser?.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
            {currentUser?.role === "ADMIN" ? <Shield size={18} /> : <UserIcon size={18} />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold truncate">{currentUser?.name || "Visitor (Unset)"}</span>
            <span className="text-[10px] text-muted-foreground">{currentUser?.role || "GUEST"} MODE</span>
          </div>
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
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4 px-2">
          <button 
            onClick={() => setShowSwitchModal(true)}
            className="w-full flex items-center gap-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-2 rounded-lg hover:bg-muted"
          >
            <LogIn size={20} />
            <span className="font-medium text-sm">Switch User</span>
          </button>
        </div>
      </aside>

      {/* Switch User Modal */}
      {showSwitchModal && (
        <div className="bg-overlay flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 flex flex-col gap-6 shadow-2xl animate-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <LogIn className="text-accent" /> Simulation Login
              </h2>
              <button 
                onClick={() => setShowSwitchModal(false)}
                className="p-1.5 text-white hover:bg-white/20 rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Select a colleague to simulate their perspective in the system.
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
              
              {colleagues.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm italic">
                  No colleagues found. Please add them in the Team Management page first.
                </div>
              )}
            </div>

            <button 
              onClick={() => handleSwitchUser(null)}
              className="premium-button text-sm w-full py-2.5 flex items-center justify-center gap-2"
            >
              Reset to Guest / Visitor Mode
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 ml-72 p-8 pt-12">
        <div className="container">
          {children}
        </div>
      </main>
    </div>
  );
}
