"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { AlertCircle, Hammer, UserPlus, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { FieldError } from "@/components/auth/field-error";
import { applyApiError } from "@/components/auth/error-keys";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { homePathForRole } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

/**
 * Client-side mirror of the register endpoint's rules. The server re-validates
 * everything — this schema exists for instant feedback, not for trust.
 */
const registerSchema = z
  .object({
    role: z.enum(["CUSTOMER", "PROFESSIONAL"]),
    firstName: z.string().trim().min(2, "validation.required").max(60, "validation.maxLength"),
    lastName: z.string().trim().min(1, "validation.required").max(60, "validation.maxLength"),
    email: z.string().trim().min(3, "validation.required").max(254, "validation.maxLength").email("validation.email"),
    phone: z
      .string()
      .trim()
      .min(9, "validation.phone")
      .max(20, "validation.phone")
      .regex(/^[0-9+\s().-]+$/, "validation.phone"),
    password: z
      .string()
      .min(8, "validation.passwordShort")
      .max(128, "validation.maxLength")
      .regex(/[a-zA-Z\u0600-\u06FF]/, "validation.passwordWeak")
      .regex(/\d/, "validation.passwordWeak"),
    confirmPassword: z.string().min(1, "validation.required"),
    // Plain `.optional()` (no `.default()`): keeps the resolver's input and
    // output types identical, which is what react-hook-form's generics need.
    city: z.string().max(60).optional(),
    businessName: z.string().max(120).optional(),
    headline: z.string().max(180).optional(),
    terms: z.boolean().refine((v) => v, "validation.required"),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "validation.passwordMatch" });
    }
    if (data.role === "PROFESSIONAL" && !data.city) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "validation.city" });
    }
  });

type RegisterValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  cities: { slug: string; name: string }[];
  defaultRole: "CUSTOMER" | "PROFESSIONAL";
}

export function RegisterForm({ cities, defaultRole }: RegisterFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: defaultRole,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      city: "",
      businessName: "",
      headline: "",
      terms: false,
    },
  });

  const role = form.watch("role");
  const isProfessional = role === "PROFESSIONAL";

  async function onSubmit(values: RegisterValues) {
    setPending(true);
    setGlobalError(null);
    try {
      const result = await api.post<{ user: { id: string; role: Role } }>("/api/auth/register", {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: values.role,
        city: values.city || null,
        businessName: values.businessName || null,
        headline: values.headline || null,
        termsAccepted: true,
      });
      toast.success(t("auth.registerSuccess"));
      router.push(homePathForRole(result.user.role));
      router.refresh();
    } catch (error) {
      const message = applyApiError(error, form.setError, t, {
        codeKeys: { RATE_LIMITED: "auth.error.tooManyAttempts" },
      });
      if (message) setGlobalError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-extrabold tracking-tight">{t("auth.register.title")}</h1>
      <p className="prose-ma mt-1.5">{t("auth.register.subtitle")}</p>

      {globalError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
          {/* Account type — ADMIN is never offered (§2). */}
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.accountType")}</FormLabel>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "CUSTOMER" as const, icon: UserRound },
                      { value: "PROFESSIONAL" as const, icon: Hammer },
                    ]
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={field.value === option.value}
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        "rounded-xl border p-3 text-start transition-colors",
                        field.value === option.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "hover:border-primary/40"
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <option.icon className="h-4 w-4 text-primary" aria-hidden />
                        {t(`auth.accountType.${option.value.toLowerCase()}`)}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                        {t(`auth.accountType.${option.value.toLowerCase()}Hint`)}
                      </span>
                    </button>
                  ))}
                </div>
                <FieldError />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
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

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.phone")}</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" autoComplete="tel" dir="ltr" className="text-start" placeholder="0612345678" />
                </FormControl>
                <FormDescription>{t("auth.phoneHint")}</FormDescription>
                <FieldError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("common.city")}
                  {!isProfessional ? <span className="ms-1 text-muted-foreground">({t("common.optional")})</span> : null}
                </FormLabel>
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("validation.city")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
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

          {isProfessional ? (
            <>
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("auth.businessName")}
                      <span className="ms-1 text-muted-foreground">({t("common.optional")})</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FieldError />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="headline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("auth.headline")}
                      <span className="ms-1 text-muted-foreground">({t("common.optional")})</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FieldError />
                  </FormItem>
                )}
              />
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.password")}</FormLabel>
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
          </div>

          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                    aria-label={t("auth.terms")}
                  />
                  <span className="text-xs leading-5 text-muted-foreground">
                    <UserPlus className="me-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
                    {t("auth.terms")}
                  </span>
                </label>
                <FieldError />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? t("auth.creatingAccount") : t("nav.register")}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary link-underline">
          {t("nav.login")}
        </Link>
      </p>
    </div>
  );
}
