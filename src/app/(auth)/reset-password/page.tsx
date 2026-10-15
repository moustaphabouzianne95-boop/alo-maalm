import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { spOptionalString, type SearchParams } from "@/lib/utils/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "auth.reset.title"), robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return <ResetPasswordForm token={spOptionalString(sp.token) ?? null} />;
}
