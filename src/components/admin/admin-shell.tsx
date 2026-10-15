"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  FileText,
  Flag,
  FolderTree,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
  Star,
  Users,
  Wrench,
} from "lucide-react";
import { BrandLink } from "@/components/layout/brand-mark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu, type NavUser } from "@/components/layout/user-menu";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: number;
}

export function AdminShell({ user, children }: { user: NavUser; children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = React.useMemo<NavItem[]>(
    () => [
      { href: "/admin", labelKey: "admin.overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/users", labelKey: "admin.users", icon: Users },
      { href: "/admin/professionals", labelKey: "admin.professionals", icon: Shield },
      { href: "/admin/services", labelKey: "admin.services", icon: Wrench },
      { href: "/admin/categories", labelKey: "admin.categories", icon: FolderTree },
      { href: "/admin/requests", labelKey: "admin.requests", icon: FileText },
      { href: "/admin/bookings", labelKey: "admin.bookings", icon: CalendarCheck },
      { href: "/admin/reviews", labelKey: "admin.reviews", icon: Star },
      { href: "/admin/reports", labelKey: "admin.reports", icon: Flag, badge: user.unreadNotifications },
      { href: "/admin/analytics", labelKey: "admin.analytics", icon: BarChart3 },
      { href: "/admin/audit", labelKey: "admin.audit", icon: ScrollText },
      { href: "/admin/notifications", labelKey: "nav.notifications", icon: Bell },
      { href: "/admin/settings", labelKey: "admin.settings", icon: Settings },
    ],
    [user.unreadNotifications]
  );

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <BrandLink stacked={false} />
          <span className="hidden rounded-full bg-ink-900 px-2 py-0.5 text-[10px] font-semibold text-white sm:inline">
            {t("admin.title")}
          </span>
          <div className="flex-1" />
          <LanguageSwitcher />
          <NotificationBell role="ADMIN" />
          <UserMenu user={user} />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-0 sm:px-6">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col gap-1 overflow-y-auto py-6 pe-2 lg:flex">
          <nav aria-label={t("admin.title")} className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-ink-900 font-semibold text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <nav aria-label={t("admin.title")} className="no-scrollbar sticky top-14 z-30 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2.5 lg:hidden">
            {items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                    active ? "bg-ink-900 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <main className="flex-1 px-4 py-6 sm:px-0 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
