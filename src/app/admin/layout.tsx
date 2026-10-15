import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getNavUser } from "@/components/layout/nav-session";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: `${translate(locale, "admin.title")} · ${translate(locale, "brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.user.role !== "ADMIN") redirect("/");
  const user = await getNavUser();
  if (!user) redirect("/login?next=/admin");
  return <AdminShell user={user}>{children}</AdminShell>;
}
