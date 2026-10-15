import type { Metadata } from "next";
import Link from "next/link";
import type { VerificationStatus } from "@prisma/client";
import { FeatureButton, VerificationActions } from "@/components/admin/moderation-actions";
import { UrlSearch } from "@/components/dashboard/url-search";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listAdminProfessionals } from "@/server/admin/lists";

const STATUSES = ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.professionals") };
}

export default async function AdminProfessionalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const verificationRaw = spString(sp.verification);
  const result = await listAdminProfessionals({
    verification: (STATUSES as readonly string[]).includes(verificationRaw) ? (verificationRaw as VerificationStatus) : undefined,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 12,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.professionals")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("admin.filter.search")} className="sm:max-w-xs sm:flex-1" />
        <div className="sm:w-56">
          <OptionSelect
            label={t("admin.filter.verification")}
            param="verification"
            allLabel={t("common.all")}
            options={STATUSES.map((value) => ({ value, label: t(`verification.status.${value}`) }))}
          />
        </div>
      </div>
      <ul className="space-y-3">
        {result.items.length === 0 && <li className="text-sm text-muted-foreground">{t("admin.empty.generic")}</li>}
        {result.items.map((profile) => (
          <li key={profile.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/admin/users/${profile.user.id}`} className="text-sm font-semibold hover:text-primary">
                  {profile.businessName || profile.user.identity?.fullName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {cityName(profile.city, locale)} · {profile.user.email} · {profile._count.services} {t("admin.services")}
                </p>
              </div>
              <StatusBadge domain="verification" value={profile.verificationStatus} label={t(`verification.status.${profile.verificationStatus}`)} size="sm" />
            </div>
            {profile.documents.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                {profile.documents.map((doc) => (
                  <li key={doc.id}>
                    <a href={doc.fileUrl} className="text-primary" target="_blank" rel="noreferrer">
                      {t(`pro.documents.type.${doc.type}`)} ({doc.status})
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <VerificationActions profileId={profile.id} status={profile.verificationStatus} />
              <FeatureButton profileId={profile.id} featured={profile.isFeatured} />
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/professionals", sp, next)} />
    </div>
  );
}
