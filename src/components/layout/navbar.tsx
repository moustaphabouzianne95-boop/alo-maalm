"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Menu, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLink } from "./brand-mark";
import { LanguageSwitcher } from "./language-switcher";
import { UserMenu, type NavUser } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

/**
 * Primary navigation (§52).
 *
 * One bar for every role: the link set changes with the session, the layout and
 * the language direction stay identical. On small screens the links collapse
 * into a sheet and the primary action stays reachable next to the search field.
 */

export interface NavbarCategory {
  slug: string;
  name: string;
  icon: string;
}

interface NavbarProps {
  user?: NavUser | null;
  categories?: NavbarCategory[];
}

function linksFor(role: Role | null, t: (key: string) => string) {
  const base = [
    { href: "/services", label: t("nav.services") },
    { href: "/professionals", label: t("nav.professionals") },
    { href: "/categories", label: t("nav.categories") },
  ];
  if (role === "CUSTOMER") {
    return [{ href: "/dashboard", label: t("nav.dashboard") }, ...base, { href: "/dashboard/requests", label: t("nav.myRequests") }];
  }
  if (role === "PROFESSIONAL") {
    return [
      { href: "/professional", label: t("nav.dashboard") },
      { href: "/professional/requests", label: t("nav.customerRequests") },
      { href: "/professional/offers", label: t("nav.myOffers") },
      { href: "/professional/services", label: t("nav.myServices") },
    ];
  }
  if (role === "ADMIN") {
    return [
      { href: "/admin", label: t("nav.admin") },
      { href: "/admin/users", label: t("admin.users") },
      { href: "/admin/services", label: t("admin.services") },
      { href: "/admin/reports", label: t("admin.reports") },
    ];
  }
  return base;
}

export function Navbar({ user, categories = [] }: NavbarProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const links = React.useMemo(() => linksFor(user?.role ?? null, t), [user?.role, t]);

  // Close the mobile sheet whenever the route changes.
  React.useEffect(() => setOpen(false), [pathname]);

  const primaryAction = user
    ? user.role === "PROFESSIONAL"
      ? { href: "/professional/services/new", label: t("nav.myServices"), icon: Plus }
      : { href: "/dashboard/requests/new", label: t("nav.postRequest"), icon: Plus }
    : { href: "/register", label: t("nav.register"), icon: Plus };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="page-shell flex h-14 items-center gap-2">
        {/* Brand */}
        <BrandLink stacked name={t("brand.name")} tagline={t("brand.tagline")} className="px-1 py-1" />

        {/* Desktop links */}
        <nav className="mx-2 hidden flex-1 items-center gap-1 lg:flex" aria-label={t("nav.menu")}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(link.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-1 lg:flex-none">
          <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex" aria-label={t("nav.searchPlaceholder")}>
            <Link href="/services">
              <Search className="h-5 w-5" aria-hidden />
            </Link>
          </Button>

          <LanguageSwitcher />

          {user ? (
            <>
              <NotificationBell role={user.role} />
              <Button asChild size="sm" className="hidden gap-1.5 sm:inline-flex">
                <Link href={primaryAction.href}>
                  <primaryAction.icon className="h-4 w-4" aria-hidden />
                  <span className="hidden md:inline">{primaryAction.label}</span>
                </Link>
              </Button>
              <UserMenu user={user} />
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t("nav.register")}</Link>
              </Button>
            </div>
          )}

          {/* Mobile sheet */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={open ? t("nav.close") : t("nav.menu")}>
                {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </Button>
            </SheetTrigger>
            <SheetContent side="end" className="w-80 p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="text-start text-base">{t("nav.menu")}</SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col overflow-y-auto pb-24">
                <nav className="flex flex-col gap-0.5 p-3" aria-label={t("nav.menu")}>
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive(link.href) ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                {categories.length ? (
                  <div className="border-t p-3">
                    <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                      {t("nav.categories")}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {categories.slice(0, 10).map((category) => (
                        <Link
                          key={category.slug}
                          href={`/categories/${category.slug}`}
                          className="truncate rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {category.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!user ? (
                  <div className="mt-auto flex gap-2 border-t p-3">
                    <Button asChild variant="outline" className="flex-1">
                      <Link href="/login">{t("nav.login")}</Link>
                    </Button>
                    <Button asChild className="flex-1">
                      <Link href="/register">{t("nav.register")}</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
