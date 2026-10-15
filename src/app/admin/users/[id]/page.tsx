import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeatureButton, PasswordResetButton, UserStatusActions, VerificationActions } from "@/components/admin/moderation-actions";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { getUserForAdmin } from "@/server/users/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const user = await loadOrNull(getUserForAdmin(id));
  return { title: user?.identity?.fullName || user?.email || translate(locale, "admin.users") };
}

export default async function AdminUserPage({ params }: Props) {
  const session = await getSession();
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const user = await loadOrNull(getUserForAdmin(id));
  if (!user) notFound();
  const profile = user.professionalProfile;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-foreground">
        {t("admin.users")}
      </Link>
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader as="h1" size="md" title={user.identity?.fullName || user.email} description={user.email} />
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={user.role} label={t(`user.role.${user.role}`)} />
            <StatusBadge domain="user" value={user.status} label={t(`user.status.${user.status}`)} />
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t("auth.phone")}</dt>
            <dd className="font-medium">{user.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("common.city")}</dt>
            <dd>{user.identity?.city ? cityName(user.identity.city, locale) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("common.memberSince")}</dt>
            <dd>{formatDateServer(user.createdAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("admin.stat.reviews")}</dt>
            <dd className="tabular-nums">{user._count.reviewsWritten}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <UserStatusActions userId={user.id} status={user.status} self={session?.user.id === user.id} />
          <PasswordResetButton userId={user.id} />
        </div>
      </section>

      {profile && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{profile.businessName || t("user.role.PROFESSIONAL")}</h2>
            <StatusBadge domain="verification" value={profile.verificationStatus} label={t(`verification.status.${profile.verificationStatus}`)} size="sm" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <Link href={`/professionals/${profile.slug}`} className="hover:text-foreground">{profile.slug}</Link>
            {" · "}
            {cityName(profile.city, locale)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <VerificationActions profileId={profile.id} status={profile.verificationStatus} />
            <FeatureButton profileId={profile.id} featured={profile.isFeatured} />
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{t("admin.verification.documents")}</h2>
        {user.documents.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.verification.noDocuments")}</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {user.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2">
                <a href={doc.fileUrl} className="font-medium text-primary" target="_blank" rel="noreferrer">
                  {t(`pro.documents.type.${doc.type}`)}
                </a>
                <span className="text-xs text-muted-foreground">{doc.status} · {formatDateServer(doc.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">{t("admin.audit")}</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {user.sessions.map((sessionRow) => (
            <li key={sessionRow.id}>
              {formatDateServer(sessionRow.createdAt, locale)} · {sessionRow.ipAddress || "—"}
              {sessionRow.revokedAt ? ` · ${t("user.status.SUSPENDED")}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
