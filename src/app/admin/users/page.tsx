import type { Metadata } from "next";
import Link from "next/link";
import type { Role, UserStatus, VerificationStatus } from "@prisma/client";
import { UrlSearch } from "@/components/dashboard/url-search";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listUsers } from "@/server/users/service";

const ROLES = ["CUSTOMER", "PROFESSIONAL", "ADMIN"] as const;
const STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "DEACTIVATED"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.users") };
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const roleRaw = spString(sp.role);
  const statusRaw = spString(sp.status);
  const verificationRaw = spString(sp.verification);
  const verifications = ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"] as const;
  const result = await listUsers({
    role: (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as Role) : undefined,
    status: (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as UserStatus) : undefined,
    verification: (verifications as readonly string[]).includes(verificationRaw) ? (verificationRaw as VerificationStatus) : undefined,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 15,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.users")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("admin.filter.search")} className="sm:max-w-xs sm:flex-1" />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <OptionSelect label={t("admin.filter.role")} param="role" allLabel={t("common.all")} options={ROLES.map((value) => ({ value, label: t(`user.role.${value}`) }))} />
          <OptionSelect label={t("admin.filter.status")} param="status" allLabel={t("common.all")} options={STATUSES.map((value) => ({ value, label: t(`user.status.${value}`) }))} />
        </div>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {result.items.length === 0 && <li className="px-4 py-8 text-sm text-muted-foreground">{t("admin.empty.generic")}</li>}
        {result.items.map((user) => (
          <li key={user.id}>
            <Link href={`/admin/users/${user.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.identity?.fullName || user.email}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email} · {user.phone}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={user.role} label={t(`user.role.${user.role}`)} size="sm" />
                <StatusBadge domain="user" value={user.status} label={t(`user.status.${user.status}`)} size="sm" />
                {user.professionalProfile && (
                  <StatusBadge domain="verification" value={user.professionalProfile.verificationStatus} label={t(`verification.status.${user.professionalProfile.verificationStatus}`)} size="sm" />
                )}
                <time className="text-[11px] text-muted-foreground">{formatDateServer(user.createdAt, locale)}</time>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/users", sp, next)} />
    </div>
  );
}
