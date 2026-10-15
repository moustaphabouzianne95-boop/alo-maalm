import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getNavUser } from "@/components/layout/nav-session";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: `${translate(locale, "dashboard.title")} · ${translate(locale, "brand.name")}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Authenticated customer workspace (§21).
 *
 * The edge proxy already gates `/dashboard` by role; this layout enforces the
 * session server-side as well, so a stale cookie can never render the shell.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");

  const user = await getNavUser();
  if (!user) redirect("/login?next=/dashboard");

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
