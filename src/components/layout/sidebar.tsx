"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Kanban,
  Bot,
  Package,
  Settings,
  Plug,
} from "lucide-react";
import { UserMenu } from "./user-menu";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/conversations", icon: MessageSquare, label: "Conversaciones" },
  { href: "/leads", icon: Users, label: "Leads" },
  { href: "/pipeline", icon: Kanban, label: "Pipeline" },
  { href: "/agents", icon: Bot, label: "Agentes IA" },
  { href: "/inventory", icon: Package, label: "Inventario" },
  { href: "/integrations", icon: Plug, label: "Integraciones" },
  { href: "/settings", icon: Settings, label: "Configuración" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
            <span className="text-sm font-bold text-sidebar">W</span>
          </div>
          <span className="text-base font-semibold hidden sm:inline">CRM WhatsApp</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 overflow-x-auto flex-1 ml-4">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="shrink-0">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
