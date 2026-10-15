"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  FileText,
  Heart,
  LayoutDashboard,
  MessageSquare,
  ReceiptText,
  Settings,
  ShieldCheck,
  Star,
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
  badge?: number;
  exact?: boolean;
}

/**
 * Chrome for the customer workspace (§21).
 *
 * The dashboard lives outside the `(public)` group, so it renders its own
 * compact topbar (brand, language, bell, account) plus a persistent sidebar
 * on desktop that collapses into a scrollable pill row on mobile.
 */
export function DashboardShell({ user, children }: { user: NavUser; children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const items = React.useMemo<NavItem[]>(
    () => [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/requests", labelKey: "nav.myRequests", icon: FileText },
      { href: "/dashboard/offers", labelKey: "nav.offers", icon: ReceiptText },
      { href: "/dashboard/bookings", labelKey: "nav.bookings", icon: CalendarCheck },
      { href: "/dashboard/favorites", labelKey: "nav.favorites", icon: Heart },
      { href: "/dashboard/reviews", labelKey: "nav.reviews", icon: Star },
      { href: "/dashboard/messages", labelKey: "nav.messages", icon: MessageSquare, badge: user.unreadMessages },
      { href: "/dashboard/notifications", labelKey: "nav.notifications", icon: Bell, badge: user.unreadNotifications },
      { href: "/dashboard/settings", labelKey: "nav.settings", icon: Settings },
    ],
    [user.unreadMessages, user.unreadNotifications]
  );

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <BrandLink stacked={false} />
          <div className="flex-1" />
          <LanguageSwitcher />
          <NotificationBell role={user.role} />
          <UserMenu user={user} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-0 sm:px-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col gap-1 overflow-y-auto py-6 pe-2 lg:flex">
          <nav aria-label={t("dashboard.title")} className="flex flex-col gap-1">
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
                    active
                      ? "bg-brand-50 font-semibold text-brand-700 ring-1 ring-inset ring-brand-100"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="truncate">{t(item.labelKey)}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white tabular-nums">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1 border-t pt-3">
            {user.role === "PROFESSIONAL" && (
              <Link
                href="/professional"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Wrench className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {t("nav.proArea")}
              </Link>
            )}
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ShieldCheck className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {t("nav.adminArea")}
              </Link>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile nav — horizontally scrollable pills */}
          <nav
            aria-label={t("dashboard.title")}
            className="no-scrollbar sticky top-14 z-30 -mx-0 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2.5 backdrop-blur lg:hidden"
          >
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-brand-600 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {t(item.labelKey)}
                  {!!item.badge && item.badge > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                        active ? "bg-white/25 text-white" : "bg-brand-600 text-white"
                      )}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
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
