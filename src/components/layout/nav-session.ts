import { cache } from "react";
import { getSession } from "@/lib/auth/session";
import { listCategories } from "@/server/categories/service";
import { unreadNotificationCount } from "@/server/notifications/service";
import { unreadMessageCount } from "@/server/messaging/service";
import type { LangCode } from "@/lib/i18n/config";
import type { NavUser } from "./user-menu";
import type { NavbarCategory } from "./navbar";

/**
 * Server-side helpers shared by every layout that renders the chrome.
 *
 * Both are wrapped in React `cache` so the navbar, the footer and the page
 * itself share one set of queries per request.
 */

export const getNavUser = cache(async (): Promise<NavUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = session.user;

  // Badge counters must never break the shell — a failure degrades to zero.
  const [unreadNotifications, unreadMessages] = await Promise.all([
    unreadNotificationCount(user.id).catch(() => 0),
    unreadMessageCount(user.id).catch(() => 0),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    professionalSlug: user.professional?.slug ?? null,
    verified: user.professional?.verificationStatus === "VERIFIED",
    unreadNotifications,
    unreadMessages,
  };
});

function localizedName(
  row: { name: string; nameFr: string | null; nameEn: string | null },
  locale: LangCode
): string {
  if (locale === "fr") return row.nameFr?.trim() || row.name;
  if (locale === "en") return row.nameEn?.trim() || row.name;
  return row.name;
}

export const getNavCategories = cache(async (locale: LangCode): Promise<NavbarCategory[]> => {
  const { items } = await listCategories({ activeOnly: true, withCounts: false, perPage: 24 });
  return items.map((category) => ({
    slug: category.slug,
    name: localizedName(category, locale),
    icon: category.icon,
  }));
});
