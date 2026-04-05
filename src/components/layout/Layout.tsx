"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileSpreadsheet, Users, Settings, LogIn } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Worksheet", icon: FileSpreadsheet },
  { href: "/colleagues", label: "Colleagues", icon: Users },
  { href: "/admin", label: "Admin Panel", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 glass-card fixed h-[calc(100vh-2rem)] m-4 flex flex-col p-4 gap-6 z-50">
        <div className="flex items-center gap-3 px-2 py-4">
          <div className="bg-accent text-accent-foreground p-2 rounded-xl">
            <FileSpreadsheet size={24} />
          </div>
          <span suppressHydrationWarning className="font-bold text-lg tracking-tight">
            Bupot PANRB
          </span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
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
          <div className="flex items-center gap-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-2 rounded-lg">
            <LogIn size={20} />
            <span className="font-medium text-sm">Switch User</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-8 pt-12">
        <div className="container">
          {children}
        </div>
      </main>
    </div>
  );
}
