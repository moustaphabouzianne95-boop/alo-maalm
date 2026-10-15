"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { FieldError } from "@/components/auth/field-error";
import { applyApiError } from "@/components/auth/error-keys";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

const forgotSchema = z.object({
  email: z.string().trim().min(3, "validation.required").max(254, "validation.maxLength").email("validation.email"),
});

type ForgotValues = z.infer<typeof forgotSchema>;

/**
 * Password reset request. The API always answers identically whether or not
 * the address exists (no user enumeration), and so does this form.
 */
export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [sent, setSent] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotValues) {
    setPending(true);
    setGlobalError(null);
    try {
      await api.post("/api/auth/forgot-password", { email: values.email });
      setSent(true);
    } catch (error) {
      const message = applyApiError(error, form.setError, t, {
        codeKeys: { RATE_LIMITED: "auth.error.tooManyAttempts" },
      });
      if (message) setGlobalError(message);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center shadow-card sm:p-8">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
        <h1 className="mt-4 text-lg font-extrabold">{t("auth.forgot.title")}</h1>
        <p className="prose-ma mx-auto mt-2 max-w-sm">{t("auth.forgot.sent")}</p>
        {process.env.NODE_ENV !== "production" ? (
          <p className="mx-auto mt-3 max-w-sm rounded-lg border border-dashed bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
            <AlertCircle className="me-1 inline h-3.5 w-3.5 text-gold-600" aria-hidden />
            {t("auth.forgot.devNote")}
          </p>
        ) : null}
        <Button asChild variant="outline" className="mt-6">
          <Link href="/login">{t("nav.login")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-extrabold tracking-tight">{t("auth.forgot.title")}</h1>
      <p className="prose-ma mt-1.5">{t("auth.forgot.subtitle")}</p>

      {globalError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.email")}</FormLabel>
                <FormControl>
                  <Input {...field} type="email" autoComplete="email" dir="ltr" className="text-start" />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            <Mail className="h-4 w-4" aria-hidden />
            {pending ? t("common.sending") : t("auth.forgot.send")}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary link-underline">
          {t("common.back")}
        </Link>
      </p>
    </div>
  );
}
