import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { homePathForRole } from "@/lib/permissions/roles";
import { spString, type SearchParams } from "@/lib/utils/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "nav.register"), robots: { index: false, follow: false } };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (session) redirect(homePathForRole(session.user.role));

  const locale = await getLocale();
  const roleParam = spString(sp.role).toUpperCase();
  // `?role=` only pre-selects between the two public roles — ADMIN is never
  // selectable and the server rejects it independently.
  const defaultRole = roleParam === "PROFESSIONAL" ? ("PROFESSIONAL" as const) : ("CUSTOMER" as const);
  const cities = CITIES.map((city) => ({ slug: city.slug, name: cityName(city.slug, locale) }));

  return <RegisterForm cities={cities} defaultRole={defaultRole} />;
}
