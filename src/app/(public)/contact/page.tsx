import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { SUPPORT_CONTACT } from "@/lib/constants/contact";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "contact.title") };
}

/**
 * Contact page.
 *
 * No in-page form on purpose: there is no contact-message endpoint yet, and a
 * form that quietly goes nowhere would be fake functionality. Real channels
 * (mailto/tel) plus the FAQ instead.
 */
export default async function ContactPage() {
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  const channels = [
    {
      icon: Mail,
      label: t("contact.email"),
      value: SUPPORT_CONTACT.email,
      href: `mailto:${SUPPORT_CONTACT.email}`,
      ltr: true,
    },
    {
      icon: Phone,
      label: t("contact.phone"),
      value: SUPPORT_CONTACT.phoneDisplay,
      href: `tel:${SUPPORT_CONTACT.phoneDial}`,
      ltr: true,
    },
    {
      icon: MapPin,
      label: t("contact.address"),
      value: SUPPORT_CONTACT.address[locale],
      href: null,
      ltr: false,
    },
    {
      icon: Clock,
      label: t("contact.hours"),
      value: t("contact.hoursValue"),
      href: null,
      ltr: false,
    },
  ];

  return (
    <div className="page-shell py-10 sm:py-14">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("contact.title")}</h1>
        <p className="prose-ma mt-3 text-base">{t("contact.subtitle")}</p>
      </header>

      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {channels.map((channel) => (
          <div key={channel.label} className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <channel.icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {channel.label}
            </h2>
            {channel.href ? (
              <a
                href={channel.href}
                dir={channel.ltr ? "ltr" : undefined}
                className="mt-1 block text-sm font-semibold link-underline"
              >
                {channel.value}
              </a>
            ) : (
              <p className="mt-1 text-sm font-semibold">{channel.value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-3">
        <Button asChild variant="outline">
          <Link href="/#faq">{t("home.faq.title")}</Link>
        </Button>
        <Button asChild>
          <Link href="/register?role=PROFESSIONAL">{t("contact.subjects.professional")}</Link>
        </Button>
      </div>
    </div>
  );
}
