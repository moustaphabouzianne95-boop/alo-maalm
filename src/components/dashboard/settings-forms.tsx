"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { FieldError } from "@/components/auth/field-error";
import { applyApiError } from "@/components/auth/error-keys";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import type { LangCode } from "@/lib/i18n/config";

const LOCALES = ["AR", "FR", "EN"] as const;

const profileSchema = z.object({
  firstName: z.string().trim().min(2, "validation.minLength").max(60, "validation.maxLength"),
  lastName: z.string().trim().min(1, "validation.minLength").max(60, "validation.maxLength"),
  phone: z.string().trim().min(9, "validation.phone").max(20, "validation.maxLength"),
  city: z.string().optional(),
  address: z.string().trim().max(300, "validation.maxLength").optional(),
  bio: z.string().trim().max(1000, "validation.maxLength").optional(),
  locale: z.enum(LOCALES),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileSettingsForm({
  defaults,
  cities,
  email,
}: {
  defaults: ProfileValues;
  cities: { slug: string; name: string }[];
  email: string;
}) {
  const { t, setLocale } = useI18n();
  const router = useRouter();
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: ProfileValues) {
    setPending(true);
    setGlobalError(null);
    try {
      await api.patch("/api/account/profile", {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        city: values.city || null,
        address: values.address || null,
        bio: values.bio || null,
        locale: values.locale,
      });
      toast.success(t("settings.profile.saved"));
      const uiLocale = values.locale.toLowerCase() as LangCode;
      setLocale(uiLocale, { reload: true });
      router.refresh();
    } catch (error) {
      const message = applyApiError(error, form.setError, t, {
        codeKeys: { CONFLICT: "auth.error.phoneTaken" },
      });
      setGlobalError(message ?? mutationMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {globalError && (
          <Alert variant="destructive">
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.firstName")}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="given-name" />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.lastName")}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="family-name" />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("auth.email")}</p>
          <Input value={email} disabled readOnly />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.phone")}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="tel" autoComplete="tel" />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.city")}</FormLabel>
                <Select value={field.value || "none"} onValueChange={(next) => field.onChange(next === "none" ? "" : next)}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.selectCity")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">{t("common.none")}</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city.slug} value={city.slug}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("bookings.address")}</FormLabel>
              <FormControl>
                <Input {...field} maxLength={300} />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("professionals.profile.about")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} maxLength={1000} />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="locale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.language")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LOCALES.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      {t(`settings.language.${locale.toLowerCase()}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t("common.save")}
        </Button>
      </form>
    </Form>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.required").max(200, "validation.maxLength"),
    newPassword: z.string().min(8, "validation.passwordShort").max(128, "validation.maxLength"),
    confirmPassword: z.string().min(1, "validation.required"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "validation.passwordMatch" });
    }
    if (!/[A-Za-z]/.test(data.newPassword) || !/\d/.test(data.newPassword)) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "validation.passwordWeak" });
    }
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export function PasswordSettingsForm() {
  const { t } = useI18n();
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: PasswordValues) {
    setPending(true);
    setGlobalError(null);
    try {
      await api.post("/api/account/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success(t("settings.password.changed"));
      form.reset();
    } catch (error) {
      const message = applyApiError(error, form.setError, t, {
        codeKeys: { UNAUTHENTICATED: "auth.error.invalidCredentials", UNPROCESSABLE_ENTITY: "validation.passwordWeak" },
      });
      setGlobalError(message ?? mutationMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {globalError && (
          <Alert variant="destructive">
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.currentPassword")}</FormLabel>
              <FormControl>
                <Input {...field} type="password" autoComplete="current-password" />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.newPassword")}</FormLabel>
              <FormControl>
                <Input {...field} type="password" autoComplete="new-password" />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.confirmPassword")}</FormLabel>
              <FormControl>
                <Input {...field} type="password" autoComplete="new-password" />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t("common.update")}
        </Button>
      </form>
    </Form>
  );
}

export function NotificationSettingsForm({
  defaults,
}: {
  defaults: { notifyByEmail: boolean; notifyByPhone: boolean; notifyByWhatsapp: boolean };
}) {
  const { t } = useI18n();
  const [values, setValues] = React.useState(defaults);
  const [pending, setPending] = React.useState(false);

  async function save(next: typeof values) {
    setValues(next);
    setPending(true);
    try {
      await api.patch("/api/account/preferences", next);
      toast.success(t("common.saved"));
    } catch (error) {
      setValues(values);
      toast.error(mutationMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  const rows = [
    { key: "notifyByEmail" as const, label: t("settings.notify.email") },
    { key: "notifyByPhone" as const, label: t("settings.notify.phone") },
    { key: "notifyByWhatsapp" as const, label: t("settings.notify.whatsapp") },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <label key={row.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
          <span>{row.label}</span>
          <Switch
            checked={values[row.key]}
            disabled={pending}
            onCheckedChange={(checked) => save({ ...values, [row.key]: checked })}
            aria-label={row.label}
          />
        </label>
      ))}
    </div>
  );
}

export function DeactivateAccountButton() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <ConfirmDialog
      variant="destructive"
      title={t("settings.deactivate.title")}
      description={t("settings.deactivate.body")}
      confirmLabel={t("settings.deactivate.confirm")}
      trigger={<Button variant="destructive">{t("settings.deactivate.confirm")}</Button>}
      onConfirm={async () => {
        try {
          await api.post("/api/account/deactivate");
          await api.post("/api/auth/logout").catch(() => undefined);
          toast.success(t("settings.deactivate.done"));
          router.push("/login");
          router.refresh();
        } catch (error) {
          toast.error(mutationMessage(error, t));
          throw error;
        }
      }}
    />
  );
}
