"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const PRICING = ["STARTING_FROM", "FIXED", "HOURLY", "CUSTOM_QUOTE"] as const;
const UNITS = ["HOUR", "DAY", "JOB", "MINUTE"] as const;

const schema = z
  .object({
    title: z.string().trim().min(5, "validation.minLength").max(120, "validation.maxLength"),
    categoryId: z.string().min(1, "validation.required"),
    description: z.string().trim().min(20, "validation.minLength").max(4000, "validation.maxLength"),
    pricingType: z.enum(PRICING),
    priceMin: z.string().optional(),
    priceMax: z.string().optional(),
    durationMin: z.string().optional(),
    durationUnit: z.enum(UNITS),
    city: z.string().min(1, "validation.city"),
    neighborhood: z.string().trim().max(80).optional(),
    keywords: z.string().max(400).optional(),
    includes: z.string().max(2000).optional(),
    warrantyDays: z.string().optional(),
    isUrgentAvailable: z.boolean(),
    publish: z.boolean(),
    coverImage: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pricingType !== "CUSTOM_QUOTE") {
      const price = Number(data.priceMin);
      if (!data.priceMin || !Number.isFinite(price) || price <= 0) {
        ctx.addIssue({ code: "custom", path: ["priceMin"], message: "validation.positiveNumber" });
      }
    }
    const max = data.priceMax ? Number(data.priceMax) : null;
    const min = data.priceMin ? Number(data.priceMin) : null;
    if (max != null && min != null && Number.isFinite(max) && Number.isFinite(min) && max < min) {
      ctx.addIssue({ code: "custom", path: ["priceMax"], message: "validation.budgetRange" });
    }
  });

type Values = z.infer<typeof schema>;

export interface ServiceFormDefaults {
  title?: string;
  categoryId?: string;
  description?: string;
  pricingType?: (typeof PRICING)[number];
  priceMin?: number | null;
  priceMax?: number | null;
  durationMin?: number | null;
  durationUnit?: (typeof UNITS)[number];
  city?: string;
  neighborhood?: string;
  keywords?: string[];
  includes?: string[];
  warrantyDays?: number;
  isUrgentAvailable?: boolean;
  coverImage?: string | null;
  status?: string;
}

function listFromText(value: string | undefined) {
  return (value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function ServiceForm({
  mode,
  serviceId,
  categories,
  cities,
  defaults,
}: {
  mode: "create" | "edit";
  serviceId?: string;
  categories: { id: string; name: string }[];
  cities: { slug: string; name: string }[];
  defaults?: ServiceFormDefaults;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaults?.title ?? "",
      categoryId: defaults?.categoryId ?? "",
      description: defaults?.description ?? "",
      pricingType: defaults?.pricingType ?? "STARTING_FROM",
      priceMin: defaults?.priceMin ? String(defaults.priceMin) : "",
      priceMax: defaults?.priceMax ? String(defaults.priceMax) : "",
      durationMin: defaults?.durationMin ? String(defaults.durationMin) : "",
      durationUnit: defaults?.durationUnit ?? "HOUR",
      city: defaults?.city ?? "",
      neighborhood: defaults?.neighborhood ?? "",
      keywords: defaults?.keywords?.join(", ") ?? "",
      includes: defaults?.includes?.join("\n") ?? "",
      warrantyDays: defaults?.warrantyDays ? String(defaults.warrantyDays) : "0",
      isUrgentAvailable: defaults?.isUrgentAvailable ?? false,
      publish: defaults?.status === "PUBLISHED",
      coverImage: defaults?.coverImage ?? "",
    },
  });

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("folder", "services");
      const stored = await api.postForm<{ url: string }>("/api/uploads", body);
      form.setValue("coverImage", stored.url);
      toast.success(t("common.saved"));
    } catch (error) {
      toast.error(mutationMessage(error, t, { UNSUPPORTED_MEDIA_TYPE: "validation.fileType", PAYLOAD_TOO_LARGE: "validation.fileSize" }));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: Values) {
    setPending(true);
    setGlobalError(null);
    const payload = {
      title: values.title,
      categoryId: values.categoryId,
      description: values.description,
      pricingType: values.pricingType,
      priceMin: values.pricingType === "CUSTOM_QUOTE" ? 0 : Math.round(Number(values.priceMin) || 0),
      priceMax: values.priceMax ? Math.round(Number(values.priceMax)) : null,
      durationMin: values.durationMin ? Math.round(Number(values.durationMin)) : null,
      durationUnit: values.durationUnit,
      city: values.city,
      neighborhood: values.neighborhood || null,
      keywords: listFromText(values.keywords),
      includes: listFromText(values.includes),
      warrantyDays: Math.max(0, Math.round(Number(values.warrantyDays) || 0)),
      isUrgentAvailable: values.isUrgentAvailable,
      coverImage: values.coverImage || null,
      ...(mode === "create"
        ? { publish: values.publish }
        : { status: values.publish ? "PUBLISHED" : defaults?.status === "PAUSED" ? "PAUSED" : "DRAFT" }),
    };
    try {
      const saved = await (mode === "create"
        ? api.post<{ id: string }>("/api/services", payload)
        : api.patch<{ id: string }>(`/api/services/${serviceId}`, payload));
      toast.success(t(mode === "create" ? "services.created" : "services.updated"));
      router.push("/professional/services");
      router.refresh();
      void saved;
    } catch (error) {
      const message = applyApiError(error, form.setError, t);
      setGlobalError(message ?? mutationMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  const pricing = form.watch("pricingType");
  const willPublish = form.watch("publish");

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
              <FormLabel>{t("services.form.title")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("services.form.titlePlaceholder")} maxLength={120} />
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
                <FormLabel>{t("services.form.category")}</FormLabel>
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
                <FormLabel>{t("services.form.city")}</FormLabel>
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
              <FormLabel>{t("services.form.description")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={6} placeholder={t("services.form.descriptionPlaceholder")} />
              </FormControl>
              <FieldError />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="pricingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("services.form.pricingType")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PRICING.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`services.pricing.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="neighborhood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("services.form.neighborhood")}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={80} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        {pricing !== "CUSTOM_QUOTE" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="priceMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("services.form.priceMin")}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" placeholder="250" />
                  </FormControl>
                  <FieldError />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priceMax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("services.form.priceMax")}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" />
                  </FormControl>
                  <FieldError />
                </FormItem>
              )}
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="durationMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("services.form.duration")}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="numeric" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="durationUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("services.form.durationUnit")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {t(`services.duration.${unit}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="includes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("services.form.includes")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} placeholder={t("services.form.includesHint")} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="keywords"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("services.form.keywords")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("services.form.keywordsHint")} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="warrantyDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("services.form.warranty")}</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" className="max-w-[140px]" />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("services.form.cover")}</p>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadCover(file);
            }}
          />
          {form.watch("coverImage") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.watch("coverImage")} alt="" className="h-28 w-44 rounded-lg object-cover" />
          )}
        </div>
        <FormField
          control={form.control}
          name="isUrgentAvailable"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
              </FormControl>
              <FormLabel className="font-normal">{t("services.form.urgent")}</FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="publish"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
              </FormControl>
              <FormLabel className="font-normal">{t("services.form.publish")}</FormLabel>
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || uploading}>
            {(pending || uploading) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t(mode === "edit" ? "common.save" : willPublish ? "services.form.publish" : "services.form.saveDraft")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
