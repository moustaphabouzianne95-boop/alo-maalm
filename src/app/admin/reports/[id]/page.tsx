import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportActions } from "@/components/admin/moderation-actions";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { getReport } from "@/server/reports/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const report = await loadOrNull(getReport(id));
  return { title: report?.reference ?? translate(locale, "admin.reports") };
}

export default async function AdminReportPage({ params }: Props) {
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const report = await loadOrNull(getReport(id));
  if (!report) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/reports" className="text-xs text-muted-foreground hover:text-foreground">
        {t("admin.reports")}
      </Link>
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader as="h1" size="md" title={report.reference} description={t(`reports.reason.${report.reason}`)} />
          <StatusBadge domain="report" value={report.status} label={t(`reports.status.${report.status}`)} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("reports.form.reason")}</dt>
            <dd>{t(`reports.target.${report.targetType}`)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("common.date")}</dt>
            <dd>{formatDateServer(report.createdAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("user.role.CUSTOMER")}</dt>
            <dd>{report.reporter.identity?.fullName || report.reporter.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("reports.target.USER")}</dt>
            <dd>
              {report.subject ? (
                <Link href={`/admin/users/${report.subject.id}`} className="font-medium text-primary">
                  {report.subject.identity?.fullName || report.subject.email}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        {report.details && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{report.details}</p>}
        {report.resolution && (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{t("admin.verification.note")}: </span>
            {report.resolution}
          </p>
        )}
        <div className="mt-5">
          <ReportActions id={report.id} status={report.status} />
        </div>
      </section>
    </div>
  );
}
