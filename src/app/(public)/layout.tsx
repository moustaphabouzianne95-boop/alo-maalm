import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { getNavCategories, getNavUser } from "@/components/layout/nav-session";
import { getLocale } from "@/lib/i18n/get-locale";
import { homePathForRole } from "@/lib/permissions/roles";

/**
 * Public shell: navbar + content + footer + phone bottom nav.
 *
 * Session, locale and the category list are resolved once here and handed down,
 * so the chrome is identical on every public route and the queries are shared
 * through React `cache`.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [user, locale] = await Promise.all([getNavUser(), getLocale()]);
  const categories = await getNavCategories(locale);
  const accountHref = user ? homePathForRole(user.role) : "/login";

  return (
    <>
      <Navbar user={user} categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer categories={categories} />
      <MobileBottomNav accountHref={accountHref} signedIn={Boolean(user)} />
    </>
  );
}
