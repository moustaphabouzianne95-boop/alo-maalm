"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

const LANGUAGES = [
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "tzm", label: "ⵜⴰⵎⴰⵣⵉⵖⵜ" },
];

const DOC_TYPES = ["CIN", "PASSPORT", "BUSINESS_REGISTRATION", "CERTIFICATE", "INSURANCE", "OTHER"] as const;

export function ProfessionalProfileForm({
  cities,
  defaults,
}: {
  cities: { slug: string; name: string }[];
  defaults: {
    businessName: string;
    headline: string;
    about: string;
    city: string;
    neighborhood: string;
    yearsExperience: number;
    serviceRadiusKm: number;
    languages: string[];
    website: string;
    phonePublic: boolean;
    publicPhone: string;
    acceptsUrgentJobs: boolean;
  };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [values, setValues] = React.useState(defaults);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleLanguage(code: string) {
    setValues((current) => ({
      ...current,
      languages: current.languages.includes(code)
        ? current.languages.filter((item) => item !== code)
        : [...current.languages, code].slice(0, 6),
    }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
          await api.patch("/api/account/professional", {
            businessName: values.businessName || null,
            headline: values.headline || null,
            about: values.about || null,
            city: values.city,
            neighborhood: values.neighborhood || null,
            yearsExperience: values.yearsExperience,
            serviceRadiusKm: values.serviceRadiusKm,
            languages: values.languages,
            website: values.website || null,
            phonePublic: values.phonePublic,
            publicPhone: values.phonePublic ? values.publicPhone || null : null,
            acceptsUrgentJobs: values.acceptsUrgentJobs,
          });
          toast.success(t("settings.profile.saved"));
          router.refresh();
        } catch (err) {
          setError(mutationMessage(err, t));
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t("auth.businessName")}</span>
        <Input value={values.businessName} onChange={(event) => setValues({ ...values, businessName: event.target.value })} maxLength={120} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t("auth.headline")}</span>
        <Input value={values.headline} onChange={(event) => setValues({ ...values, headline: event.target.value })} maxLength={180} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t("professionals.profile.about")}</span>
        <Textarea value={values.about} onChange={(event) => setValues({ ...values, about: event.target.value })} rows={5} maxLength={4000} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("common.city")}</span>
          <Select value={values.city} onValueChange={(city) => setValues({ ...values, city })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.slug} value={city.slug}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("common.neighborhood")}</span>
          <Input value={values.neighborhood} onChange={(event) => setValues({ ...values, neighborhood: event.target.value })} maxLength={80} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("pro.form.years")}</span>
          <Input
            inputMode="numeric"
            value={String(values.yearsExperience)}
            onChange={(event) => setValues({ ...values, yearsExperience: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("pro.form.radius")}</span>
          <Input
            inputMode="numeric"
            value={String(values.serviceRadiusKm)}
            onChange={(event) => setValues({ ...values, serviceRadiusKm: Math.max(1, Number(event.target.value) || 1) })}
          />
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("professionals.profile.languages")}</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((language) => {
            const on = values.languages.includes(language.code);
            return (
              <button
                key={language.code}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLanguage(language.code)}
                className={on ? "rounded-full bg-brand-600 px-3 py-1 text-xs text-white" : "rounded-full bg-muted px-3 py-1 text-xs"}
              >
                {language.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Website</span>
        <Input value={values.website} onChange={(event) => setValues({ ...values, website: event.target.value })} placeholder="https://" />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
        <span>{t("services.form.urgent")}</span>
        <Switch checked={values.acceptsUrgentJobs} onCheckedChange={(checked) => setValues({ ...values, acceptsUrgentJobs: checked })} />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
        <span>{t("auth.phone")}</span>
        <Switch checked={values.phonePublic} onCheckedChange={(checked) => setValues({ ...values, phonePublic: checked })} />
      </label>
      {values.phonePublic && (
        <Input value={values.publicPhone} onChange={(event) => setValues({ ...values, publicPhone: event.target.value })} inputMode="tel" />
      )}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {t("common.save")}
      </Button>
    </form>
  );
}

export function DocumentUpload() {
  const { t } = useI18n();
  const router = useRouter();
  const [type, setType] = React.useState<(typeof DOC_TYPES)[number]>("CIN");
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const input = (event.currentTarget.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0];
        if (!input) return;
        setPending(true);
        try {
          const body = new FormData();
          body.set("file", input);
          body.set("type", type);
          await api.postForm("/api/account/verification", body);
          toast.success(t("pro.documents.uploaded"));
          router.refresh();
          event.currentTarget.reset();
        } catch (error) {
          toast.error(mutationMessage(error, t, { UNSUPPORTED_MEDIA_TYPE: "validation.fileType", PAYLOAD_TOO_LARGE: "validation.fileSize" }));
        } finally {
          setPending(false);
        }
      }}
    >
      <Select value={type} onValueChange={(next) => setType(next as (typeof DOC_TYPES)[number])}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DOC_TYPES.map((item) => (
            <SelectItem key={item} value={item}>
              {t(`pro.documents.type.${item}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
      <Button type="submit" size="sm" disabled={pending}>
        {t("common.add")}
      </Button>
    </form>
  );
}
