import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { homePathForRole } from "@/lib/permissions/roles";
import { spOptionalString, type SearchParams } from "@/lib/utils/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "nav.login"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  // Already signed in? Straight to the right dashboard — no login form.
  const session = await getSession();
  if (session) redirect(homePathForRole(session.user.role));

  // The edge proxy sends guests to `?callbackUrl=`; in-app links use `?next=`.
  return <LoginForm next={spOptionalString(sp.next) ?? spOptionalString(sp.callbackUrl)} />;
}
