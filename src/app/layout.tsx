import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getLocale } from "@/lib/i18n/get-locale";
import { dirFor } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  return {
    metadataBase: new URL(APP_URL),
    title: {
      default: `${t("brand.name")} — ${t("brand.tagline")}`,
      template: `%s · ${t("brand.name")}`,
    },
    description: t("home.hero.subtitle"),
    applicationName: t("brand.name"),
    keywords: [
      "خدمات المغرب",
      "معلم",
      "سباكة",
      "كهرباء",
      "صباغة",
      "services Maroc",
      "artisan Maroc",
      "plombier Casablanca",
      "Morocco services marketplace",
    ],
    authors: [{ name: "Alo Maalem", url: APP_URL }],
    creator: "Alo Maalem",
    publisher: "Alo Maalem",
    formatDetection: { telephone: false, address: false, email: false },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: locale === "ar" ? "ar_MA" : locale === "fr" ? "fr_MA" : "en_US",
      url: APP_URL,
      siteName: t("brand.name"),
      title: `${t("brand.name")} — ${t("brand.tagline")}`,
      description: t("home.hero.subtitle"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("brand.name"),
      description: t("home.hero.subtitle"),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/icon.svg" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1226" },
  ],
  colorScheme: "light",
};

/**
 * Root layout.
 *
 * `dir` and `lang` are set on <html> from the resolved locale so Arabic renders
 * RTL from the very first paint — no flash of the wrong direction, no client
 * round-trip. The provider stack supplies the same locale to client islands.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir} data-locale={locale} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          {translate(locale, "nav.home")}
        </a>
        <Providers locale={locale}>
          <div id="main" className="flex min-h-dvh flex-col">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
