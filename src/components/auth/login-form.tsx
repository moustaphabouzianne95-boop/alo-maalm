"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { AlertCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { FieldError } from "@/components/auth/field-error";
import { applyApiError, safeNextPath } from "@/components/auth/error-keys";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { homePathForRole } from "@/lib/permissions/roles";

const loginSchema = z.object({
  identifier: z.string().trim().min(3, "validation.required").max(254, "validation.maxLength"),
  password: z.string().min(1, "validation.required").max(200, "validation.maxLength"),
});

type LoginValues = z.infer<typeof loginSchema>;

/** Development-only convenience (§45): one click fills a seeded demo account. */
const DEMO_ACCOUNTS: { email: string; labelKey: string }[] = [
  { email: "admin@alomaalem.ma", labelKey: "nav.admin" },
  { email: "customer@alomaalem.ma", labelKey: "auth.accountType.customer" },
  { email: "professional@alomaalem.ma", labelKey: "auth.accountType.professional" },
];
const DEMO_PASSWORD = "Demo@12345";

interface LoginFormProps {
  next?: string | null;
}

export function LoginForm({ next }: LoginFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setPending(true);
    setGlobalError(null);
    try {
      const result = await api.post<{ user: { role: Role }; redirectTo?: string }>(
        "/api/auth/login",
        values
      );
      toast.success(t("auth.loginSuccess"));
      const target = safeNextPath(next) ?? result.redirectTo ?? homePathForRole(result.user.role);
      router.push(target);
      router.refresh();
    } catch (error) {
      const message = applyApiError(error, form.setError, t, {
        codeKeys: {
          UNAUTHENTICATED: "auth.error.invalidCredentials",
          FORBIDDEN: "auth.error.accountSuspended",
          LOCKED: "auth.error.accountLocked",
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
      <h1 className="text-xl font-extrabold tracking-tight">{t("auth.login.title")}</h1>
      <p className="prose-ma mt-1.5">{t("auth.login.subtitle")}</p>

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
            name="identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.identifier")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    autoComplete="username"
                    placeholder="customer@alomaalem.ma"
                    dir="ltr"
                    className="text-start"
                  />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary link-underline"
                  >
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="pe-10"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label={t("auth.password")}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            <KeyRound className="h-4 w-4" aria-hidden />
            {pending ? t("auth.signingIn") : t("nav.login")}
          </Button>
        </form>
      </Form>

      {process.env.NODE_ENV !== "production" ? (
        <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <AlertCircle className="h-3.5 w-3.5 text-gold-600" aria-hidden />
            {t("auth.demoAccounts")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("auth.demoHint", { password: DEMO_PASSWORD })}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-1.5 text-start text-[11px] transition-colors hover:border-primary/40"
                  onClick={() => {
                    form.setValue("identifier", account.email);
                    form.setValue("password", DEMO_PASSWORD);
                    form.clearErrors();
                    setGlobalError(null);
                  }}
                >
                  <span dir="ltr" className="font-medium">
                    {account.email}
                  </span>
                  <span className="text-muted-foreground">{t(account.labelKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-primary link-underline">
          {t("nav.register")}
        </Link>
      </p>
    </div>
  );
}
