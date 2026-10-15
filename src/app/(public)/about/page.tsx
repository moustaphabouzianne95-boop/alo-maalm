import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ListChecks, MapPin, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { formatNumberServer } from "@/lib/i18n/server-format";
import { CITIES } from "@/lib/constants/morocco";
import { listCategories } from "@/server/categories/service";
import { homeStats } from "@/server/home/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "about.title") };
}

/** Static "about" page — copy from the dictionaries, counters from the DB. */
export default async function AboutPage() {
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  const [stats, categories] = await Promise.all([homeStats(), listCategories({ perPage: 50 })]);

  const trustPoints = [
    { icon: BadgeCheck, body: t("about.how.1") },
    { icon: ShieldCheck, body: t("about.how.2") },
    { icon: ListChecks, body: t("about.how.3") },
    { icon: Users, body: t("about.how.4") },
  ];

  const counters = [
    { icon: MapPin, value: formatNumberServer(CITIES.length, locale), label: t("about.stats.cities") },
    { icon: ListChecks, value: formatNumberServer(categories.total, locale), label: t("about.stats.categories") },
    { icon: Users, value: formatNumberServer(stats.verifiedProfessionals, locale), label: t("about.stats.professionals") },
  ];

  return (
    <div className="page-shell py-10 sm:py-14">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("about.title")}</h1>
        <p className="prose-ma mt-3 text-base">{t("about.subtitle")}</p>
      </header>

      <section className="mx-auto mt-10 max-w-3xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold">{t("about.mission.title")}</h2>
        <p className="prose-ma mt-3 text-sm">{t("about.mission.body")}</p>
      </section>

      <section className="mx-auto mt-8 max-w-3xl">
        <h2 className="text-lg font-bold">{t("about.how.title")}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {trustPoints.map((point) => (
            <li key={point.body} className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <point.icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <p className="text-xs leading-6 text-muted-foreground">{point.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <dl className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-3">
        {counters.map((counter) => (
          <div key={counter.label} className="rounded-xl border bg-card p-5 text-center shadow-sm">
            <counter.icon className="mx-auto h-5 w-5 text-primary" aria-hidden />
            <dd className="mt-2 text-2xl font-extrabold" dir="ltr">
              {counter.value}
            </dd>
            <dt className="mt-1 text-xs text-muted-foreground">{counter.label}</dt>
          </div>
        ))}
      </dl>

      <section className="mx-auto mt-8 max-w-3xl rounded-2xl bg-ink-950 p-6 text-center sm:p-8">
        <h2 className="text-lg font-bold text-white">{t("about.team.title")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-ink-200">{t("about.team.body")}</p>
        <Button asChild variant="gold" className="mt-6">
          <Link href="/register?role=PROFESSIONAL">{t("home.proCta.button")}</Link>
        </Button>
      </section>
    </div>
  );
}
