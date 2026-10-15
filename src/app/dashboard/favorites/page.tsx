import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfessionalCard } from "@/components/professionals/professional-card";
import { ServiceCard } from "@/components/services/service-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { buildPageHref, spEnum, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listFavorites } from "@/server/favorites/service";
import { toCard } from "@/server/professionals/service";
import type { ServiceCardRow } from "@/server/services/service";

const TABS = ["services", "professionals"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "favorites.page.title") };
}

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/favorites");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const tab = spEnum(sp.tab, TABS, "services");
  const page = spPage(sp.page);
  const result = await listFavorites(session.user.id, {
    targetType: tab === "services" ? "SERVICE" : "PROFESSIONAL",
    page,
    perPage: 12,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("favorites.page.title")} />
      <nav className="flex gap-1" aria-label={t("favorites.page.title")}>
        {TABS.map((value) => (
          <Link
            key={value}
            href={value === "services" ? "/dashboard/favorites" : "/dashboard/favorites?tab=professionals"}
            aria-current={tab === value ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              tab === value ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground"
            )}
          >
            {t(value === "services" ? "favorites.tabs.services" : "favorites.tabs.professionals")}
          </Link>
        ))}
      </nav>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title={t(tab === "services" ? "favorites.empty.services.title" : "favorites.empty.professionals.title")}
          description={t(tab === "services" ? "favorites.empty.services.body" : "favorites.empty.professionals.body")}
          action={
            <Button asChild>
              <Link href={tab === "services" ? "/services" : "/professionals"}>{t("favorites.empty.cta")}</Link>
            </Button>
          }
        />
      ) : tab === "services" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((item) =>
            item.service && item.service.status === "PUBLISHED" ? (
              <ServiceCard key={item.id} service={item.service as ServiceCardRow} locale={locale} />
            ) : (
              <div key={item.id} className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {t("services.detail.notFound")}
              </div>
            )
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((item) =>
            item.professional ? (
              <ProfessionalCard key={item.id} professional={toCard(item.professional)} locale={locale} />
            ) : (
              <div key={item.id} className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {t("professionals.profile.notFound")}
              </div>
            )
          )}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        perPage={result.perPage}
        locale={locale}
        hrefFor={(next) => buildPageHref("/dashboard/favorites", sp, next)}
      />
    </div>
  );
}
