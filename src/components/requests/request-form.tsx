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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { FieldError } from "@/components/auth/field-error";
import { applyApiError } from "@/components/auth/error-keys";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

const URGENCIES = ["NORMAL", "URGENT", "EMERGENCY"] as const;

const requestFormSchema = z
  .object({
    title: z.string().trim().min(5, "validation.minLength").max(120, "validation.maxLength"),
    categoryId: z.string().min(1, "validation.required"),
    description: z.string().trim().min(20, "validation.minLength").max(4000, "validation.maxLength"),
    city: z.string().min(1, "validation.city"),
    neighborhood: z.string().trim().max(80).optional(),
    address: z.string().trim().max(300).optional(),
    budgetMin: z.string().optional(),
    budgetMax: z.string().optional(),
    preferredDate: z.string().optional(),
    preferredTime: z.string().trim().max(24).optional(),
    urgency: z.enum(URGENCIES),
  })
  .superRefine((data, ctx) => {
    const min = data.budgetMin ? Number(data.budgetMin) : null;
    const max = data.budgetMax ? Number(data.budgetMax) : null;
    if ((data.budgetMin && !Number.isFinite(min)) || (data.budgetMax && !Number.isFinite(max))) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "validation.positiveNumber" });
    }
    if (min != null && max != null && Number.isFinite(min) && Number.isFinite(max) && max < min) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "validation.budgetRange" });
    }
  });

type RequestFormValues = z.infer<typeof requestFormSchema>;

export interface RequestFormDefaults {
  title?: string;
  categoryId?: string;
  description?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredDate?: string;
  preferredTime?: string;
  urgency?: (typeof URGENCIES)[number];
}

interface RequestFormProps {
  mode: "create" | "edit";
  requestId?: string;
  serviceId?: string | null;
  categories: { id: string; name: string }[];
  cities: { slug: string; name: string }[];
  defaults?: RequestFormDefaults;
}

function moneyField(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Customer request form (§12). The server remains authoritative: this schema
 * only mirrors the rules so errors appear next to the field before the round trip.
 */
export function RequestForm({ mode, requestId, serviceId, categories, cities, defaults }: RequestFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      title: defaults?.title ?? "",
      categoryId: defaults?.categoryId ?? "",
      description: defaults?.description ?? "",
      city: defaults?.city ?? "",
      neighborhood: defaults?.neighborhood ?? "",
      address: defaults?.address ?? "",
      budgetMin: defaults?.budgetMin != null ? String(defaults.budgetMin) : "",
      budgetMax: defaults?.budgetMax != null ? String(defaults.budgetMax) : "",
      preferredDate: defaults?.preferredDate ?? "",
      preferredTime: defaults?.preferredTime ?? "",
      urgency: defaults?.urgency ?? "NORMAL",
    },
  });

  async function onSubmit(values: RequestFormValues) {
    setPending(true);
    setGlobalError(null);
    const body = {
      title: values.title,
      categoryId: values.categoryId,
      description: values.description,
      city: values.city,
      neighborhood: values.neighborhood || null,
      address: values.address || null,
      budgetMin: moneyField(values.budgetMin),
      budgetMax: moneyField(values.budgetMax),
      preferredDate: values.preferredDate || null,
      preferredTime: values.preferredTime || null,
      urgency: values.urgency,
      ...(mode === "create" && serviceId ? { serviceId } : {}),
    };

    try {
      const saved = await (mode === "create"
        ? api.post<{ id: string }>("/api/requests", body)
        : api.patch<{ id: string }>(`/api/requests/${requestId}`, body));
      toast.success(t(mode === "create" ? "requests.created" : "requests.updated"));
      router.push(`/dashboard/requests/${saved.id}`);
      router.refresh();
    } catch (error) {
      const message = applyApiError(error, form.setError, t);
      setGlobalError(message ?? mutationMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {globalError && (
          <Alert variant="destructive">
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("requests.form.title")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("requests.form.titlePlaceholder")} maxLength={120} />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("requests.form.category")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.selectCategory")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("requests.form.city")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.selectCity")} />
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
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("requests.form.description")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={6} placeholder={t("requests.form.descriptionPlaceholder")} maxLength={4000} />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="neighborhood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("requests.form.neighborhood")} <span className="text-muted-foreground">({t("common.optional")})</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} maxLength={80} />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="urgency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("requests.form.urgency")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {URGENCIES.map((urgency) => (
                      <SelectItem key={urgency} value={urgency}>
                        {t(`requests.urgency.${urgency}`)}
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
              <FormLabel>
                {t("requests.form.address")} <span className="text-muted-foreground">({t("common.optional")})</span>
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("requests.form.addressHint")} maxLength={300} />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t("requests.form.budget")}</legend>
          <p className="text-xs text-muted-foreground">{t("requests.form.budgetHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="budgetMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("requests.form.budgetMin")}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" placeholder="150" />
                  </FormControl>
                  <FieldError />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="budgetMax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("requests.form.budgetMax")}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" placeholder="400" />
                  </FormControl>
                  <FieldError />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="preferredDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("requests.form.preferredDate")} <span className="text-muted-foreground">({t("common.optional")})</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="preferredTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("requests.form.preferredTime")} <span className="text-muted-foreground">({t("common.optional")})</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="09:00-12:00" maxLength={24} />
                </FormControl>
                <FieldError />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t(mode === "create" ? "requests.form.submit" : "requests.form.update")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
