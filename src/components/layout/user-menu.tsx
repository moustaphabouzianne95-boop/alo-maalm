"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  BookMarked,
  FileText,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Star,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { homePathForRole } from "@/lib/permissions/roles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { api, errorMessageKey, isApiClientError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { initialsOf } from "@/lib/utils";
import type { Role } from "@prisma/client";

export interface NavUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  professionalSlug?: string | null;
  verified?: boolean;
  unreadNotifications?: number;
  unreadMessages?: number;
}

interface LinkItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

/** Role-aware account menu. Every entry is a real route; nothing is decorative. */
export function UserMenu({ user, align = "end" }: { user: NavUser; align?: "start" | "end" }) {
  const router = useRouter();
  const { t } = useI18n();
  const [signingOut, setSigningOut] = React.useState(false);

  const items = React.useMemo<LinkItem[]>(() => {
    const shared: LinkItem[] = [
      { href: `${homePathForRole(user.role)}/settings`, label: t("nav.settings"), icon: Settings },
      { href: `${homePathForRole(user.role)}/notifications`, label: t("nav.notifications"), icon: Bell, badge: user.unreadNotifications },
    ];
    if (user.role === "CUSTOMER") {
      return [
        { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
        { href: "/dashboard/requests", label: t("nav.myRequests"), icon: FileText },
        { href: "/dashboard/bookings", label: t("nav.bookings"), icon: BookMarked },
        { href: "/dashboard/messages", label: t("nav.messages"), icon: FileText, badge: user.unreadMessages },
        { href: "/dashboard/favorites", label: t("nav.favorites"), icon: Heart },
        { href: "/dashboard/reviews", label: t("nav.reviews"), icon: Star },
        ...shared,
      ];
    }
    if (user.role === "PROFESSIONAL") {
      return [
        { href: "/professional", label: t("nav.dashboard"), icon: LayoutDashboard },
        { href: "/professional/requests", label: t("nav.customerRequests"), icon: FileText },
        { href: "/professional/offers", label: t("nav.myOffers"), icon: FileText },
        { href: "/professional/bookings", label: t("nav.bookings"), icon: BookMarked },
        { href: "/professional/messages", label: t("nav.messages"), icon: FileText, badge: user.unreadMessages },
        { href: "/professional/services", label: t("nav.myServices"), icon: Menu },
        { href: "/professional/reviews", label: t("nav.reviews"), icon: Star },
        { href: `/professionals/${user.professionalSlug ?? ""}`, label: t("pro.publicProfile"), icon: ShieldCheck },
        ...shared,
      ];
    }
    return [
      { href: "/admin", label: t("nav.admin"), icon: ShieldCheck },
      { href: "/admin/users", label: t("admin.users"), icon: UserIcon },
      { href: "/admin/reports", label: t("admin.reports"), icon: FileText },
      { href: "/admin/analytics", label: t("admin.analytics"), icon: LayoutDashboard },
      ...shared,
    ];
  }, [t, user.role, user.professionalSlug, user.unreadNotifications, user.unreadMessages]);

  const signOut = React.useCallback(async () => {
    setSigningOut(true);
    try {
      await api.post("/api/auth/logout");
      toast.info(t("auth.logoutSuccess"));
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(isApiClientError(error) ? t(errorMessageKey(error.code)) : t("common.genericError"));
      setSigningOut(false);
    }
  }, [router, t]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2" aria-label={t("nav.menu")}>
          <Avatar className="h-7 w-7">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initialsOf(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          <span className="mt-1 flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {t(`user.role.${user.role}`)}
            </Badge>
            {user.verified ? (
              <Badge variant="success" className="gap-1 text-[10px]">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {t("verification.verified")}
              </Badge>
            ) : null}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {items.map((item) => (
            <DropdownMenuItem key={item.href} asChild className="gap-2">
              <Link href={item.href}>
                <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} disabled={signingOut} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" aria-hidden />
          <span>{signingOut ? t("common.loading") : t("nav.logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
