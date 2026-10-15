import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "auth.forgot.title"), robots: { index: false, follow: false } };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
