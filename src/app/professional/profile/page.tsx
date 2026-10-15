import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentUpload, ProfessionalProfileForm } from "@/components/professional/profile-form";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { getOwnProfessionalProfile } from "@/server/professionals/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "professionals.profile.editProfile") };
}

export default async function ProfessionalProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/profile");
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const profile = await loadOrNull(getOwnProfessionalProfile(session.user.id));
  if (!profile) notFound();

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-5">
      <section className="space-y-4 lg:col-span-3">
        <SectionHeader
          as="h1"
          size="lg"
          title={t("professionals.profile.editProfile")}
          action={
            <Link href={`/professionals/${profile.slug}`} className="text-sm font-medium text-primary">
              {t("common.viewDetails")}
            </Link>
          }
        />
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <ProfessionalProfileForm
            cities={CITIES.map((city) => ({ slug: city.slug, name: cityName(city.slug, locale) }))}
            defaults={{
              businessName: profile.businessName ?? "",
              headline: profile.headline ?? "",
              about: profile.about ?? "",
              city: profile.city,
              neighborhood: profile.neighborhood ?? "",
              yearsExperience: profile.yearsExperience,
              serviceRadiusKm: profile.serviceRadiusKm,
              languages: profile.languages,
              website: profile.website ?? "",
              phonePublic: profile.phonePublic,
              publicPhone: profile.publicPhone ?? "",
              acceptsUrgentJobs: profile.acceptsUrgentJobs,
            }}
          />
        </div>
      </section>
      <aside className="space-y-4 lg:col-span-2">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t("pro.verification.title")}</h2>
            <StatusBadge
              domain="verification"
              value={profile.verificationStatus}
              label={t(`verification.status.${profile.verificationStatus}`)}
              size="sm"
            />
          </div>
          {profile.verificationNote && <p className="mt-2 text-xs text-muted-foreground">{profile.verificationNote}</p>}
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">{t("pro.documents.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("pro.documents.hint")}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {profile.documents.length === 0 && <li className="text-muted-foreground">{t("common.noResults")}</li>}
            {profile.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2">
                <span>{t(`pro.documents.type.${doc.type}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {doc.status === "APPROVED" ? t("professionals.profile.verified") : t(`verification.status.${doc.status}`)} · {formatDateServer(doc.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <DocumentUpload />
          </div>
        </section>
      </aside>
    </div>
  );
}
