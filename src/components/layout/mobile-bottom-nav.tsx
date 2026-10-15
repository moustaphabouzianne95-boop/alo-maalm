"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, UserRound, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  /** `null` for anonymous visitors — the last tab then points at /login. */
  accountHref: string;
  signedIn: boolean;
}

/**
 * Thumb-reach navigation for phones (§10: mobile-first).
 *
 * Five destinations only, mirroring the desktop navbar. Hidden from `lg` up,
 * where the navbar carries the same links.
 */
export function MobileBottomNav({ accountHref, signedIn }: MobileBottomNavProps) {
  const { t } = useI18n();
  const pathname = usePathname();

  const items = [
    { href: "/", label: t("nav.home"), icon: Home, exact: true },
    { href: "/categories", label: t("nav.categories"), icon: LayoutGrid },
    { href: "/services", label: t("nav.services"), icon: Search },
    { href: "/professionals", label: t("nav.professionals"), icon: Users },
    { href: accountHref, label: signedIn ? t("nav.dashboard") : t("nav.login"), icon: UserRound },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label={t("nav.menu")}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
