import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";

/** Localised 404 — no stack traces, no dead ends: two ways forward. */
export default async function NotFound() {
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="page-shell flex flex-1 flex-col items-center justify-center py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-5 text-5xl font-extrabold tracking-tight text-primary" dir="ltr">
        404
      </p>
      <h1 className="mt-2 text-xl font-bold">{t("notFound.title")}</h1>
      <p className="prose-ma mt-2 max-w-sm">{t("notFound.body")}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">{t("nav.home")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/services">{t("nav.services")}</Link>
        </Button>
      </div>
    </div>
  );
}
