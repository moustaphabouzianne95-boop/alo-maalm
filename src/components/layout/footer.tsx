import Link from "next/link";
import { ArrowUp, Mail, MapPin, Phone } from "lucide-react";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { CategoryIcon } from "@/components/icons/category-icon";
import { BrandLink } from "./brand-mark";
import type { NavbarCategory } from "./navbar";

const SUPPORT_EMAIL = "support@alomaalem.ma";
const SUPPORT_PHONE = "+212 5 37 20 41 04";

/**
 * Site footer (§52).
 *
 * Rendered on the server straight from the same category list the navbar uses,
 * so the two can never drift apart. Every link points at a route that exists —
 * no dead legal pages, no decorative newsletter form.
 */
export async function Footer({ categories }: { categories: NavbarCategory[] }) {
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const year = new Date().getFullYear();

  const marketplaceLinks = [
    { href: "/services", label: t("nav.services") },
    { href: "/professionals", label: t("nav.professionals") },
    { href: "/categories", label: t("nav.categories") },
    { href: "/about", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
  ];

  return (
    <footer className="mt-auto mb-16 border-t bg-ink-950 text-ink-100 lg:mb-0">
      <div className="page-shell py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <BrandLink dark name={t("brand.name")} />
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-200">{t("brand.tagline")}</p>
            <p className="mt-4 text-xs leading-5 text-ink-300">{t("footer.languageNote")}</p>
            <div className="mt-4 space-y-1.5 text-xs text-ink-200">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 hover:text-white">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                <span dir="ltr">{SUPPORT_EMAIL}</span>
              </a>
              <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-white">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                <span dir="ltr">{SUPPORT_PHONE}</span>
              </a>
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {locale === "ar" ? "الدار البيضاء — وجدة، المغرب" : locale === "fr" ? "Casablanca — Oujda, Maroc" : "Casablanca — Oujda, Morocco"}
              </p>
            </div>
          </div>

          {/* Marketplace */}
          <nav aria-label={t("footer.marketplace")}>
            <h3 className="text-sm font-semibold text-white">{t("footer.marketplace")}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {marketplaceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink-200 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="/#faq" className="text-ink-200 transition-colors hover:text-white">
                  {t("home.faq.title")}
                </a>
              </li>
            </ul>
          </nav>

          {/* Categories */}
          <nav aria-label={t("footer.popularCategories")}>
            <h3 className="text-sm font-semibold text-white">{t("footer.popularCategories")}</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {categories.slice(0, 8).map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="flex items-center gap-2 text-ink-200 transition-colors hover:text-white"
                  >
                    <CategoryIcon name={category.icon} className="h-4 w-4 text-brand-400" />
                    <span className="truncate">{category.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Cities */}
          <nav aria-label={t("footer.cities")}>
            <h3 className="text-sm font-semibold text-white">{t("footer.cities")}</h3>
            <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {CITIES.slice(0, 12).map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/services?city=${city.slug}`}
                    className="truncate text-ink-200 transition-colors hover:text-white"
                  >
                    {cityName(city.slug, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-10 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs leading-6 text-ink-200">
          {t("footer.disclaimer")}
        </p>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-ink-300 sm:flex-row">
          <p>{t("footer.rights", { year })}</p>
          <div className="flex items-center gap-4">
            <span>{t("footer.madeIn")}</span>
            <a href="#main" className="flex items-center gap-1 transition-colors hover:text-white">
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              {t("footer.backToTop")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
