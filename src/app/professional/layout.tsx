import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfessionalShell } from "@/components/professional/professional-shell";
import { getNavUser } from "@/components/layout/nav-session";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: `${translate(locale, "pro.title")} · ${translate(locale, "brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional");
  if (session.user.role === "CUSTOMER") redirect("/dashboard");

  const user = await getNavUser();
  if (!user) redirect("/login?next=/professional");

  return <ProfessionalShell user={user}>{children}</ProfessionalShell>;
}
