import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listAuditLogs } from "@/server/users/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.audit") };
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const result = await listAuditLogs({
    action: spOptionalString(sp.action),
    targetType: spOptionalString(sp.type),
    page: spPage(sp.page),
    perPage: 25,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.audit")} />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm">
        {result.items.length === 0 && <li className="px-4 py-8 text-muted-foreground">{t("admin.empty.generic")}</li>}
        {result.items.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{entry.action}</p>
              <p className="text-xs text-muted-foreground">
                {entry.targetType}
                {entry.targetUserId ? (
                  <>
                    {" · "}
                    <Link href={`/admin/users/${entry.targetUserId}`} className="hover:text-foreground">
                      {entry.actor?.identity?.fullName || entry.actor?.email || entry.targetUserId}
                    </Link>
                  </>
                ) : (
                  entry.actor && ` · ${entry.actor.identity?.fullName || entry.actor.email}`
                )}
              </p>
            </div>
            <time className="text-xs text-muted-foreground">{formatDateServer(entry.createdAt, locale)}</time>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/audit", sp, next)} />
    </div>
  );
}
