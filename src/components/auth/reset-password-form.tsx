"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { FieldError } from "@/components/auth/field-error";
import { applyApiError } from "@/components/auth/error-keys";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "validation.passwordShort")
      .max(128, "validation.maxLength")
      .regex(/[a-zA-Z\u0600-\u06FF]/, "validation.passwordWeak")
      .regex(/\d/, "validation.passwordWeak"),
    confirmPassword: z.string().min(1, "validation.required"),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "validation.passwordMatch" });
    }
  });

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordForm({ token }: { token: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center shadow-card sm:p-8">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
        <h1 className="mt-4 text-lg font-extrabold">{t("auth.reset.title")}</h1>
        <p className="prose-ma mx-auto mt-2 max-w-sm">{t("auth.reset.invalid")}</p>
        <Button asChild className="mt-6">
          <Link href="/forgot-password">{t("auth.forgot.title")}</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(values: ResetValues) {
    setPending(true);
    setGlobalError(null);
    try {
      await api.post("/api/auth/reset-password", { token, password: values.password });
      toast.success(t("auth.reset.success"));
      router.push("/login");
      router.refresh();
    } catch (error) {
      const message = applyApiError(error, form.setError, t, {
        codeKeys: {
          BAD_REQUEST: "auth.reset.invalid",
          UNPROCESSABLE_ENTITY: "validation.passwordShort",
          RATE_LIMITED: "auth.error.tooManyAttempts",
        },
      });
      if (message) setGlobalError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-extrabold tracking-tight">{t("auth.reset.title")}</h1>
      <p className="prose-ma mt-1.5">{t("auth.reset.subtitle")}</p>

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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.newPassword")}</FormLabel>
                <FormControl>
                  <Input {...field} type="password" autoComplete="new-password" dir="ltr" />
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
                  <Input {...field} type="password" autoComplete="new-password" dir="ltr" />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            <KeyRound className="h-4 w-4" aria-hidden />
            {pending ? t("common.saving") : t("auth.reset.submit")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
