"use client";

import {
  BellRing,
  ClipboardList,
  Hammer,
  Inbox,
  ListPlus,
  Send,
  Star,
  TrendingUp,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n/provider";

const CUSTOMER_ICONS: LucideIcon[] = [ClipboardList, Inbox, UserCheck, Hammer, Star];
const PROFESSIONAL_ICONS: LucideIcon[] = [UserPlus, ListPlus, BellRing, Send, TrendingUp];

function Steps({ audience, icons }: { audience: "customer" | "professional"; icons: LucideIcon[] }) {
  const { t } = useI18n();
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[1, 2, 3, 4, 5].map((step, index) => {
        const Icon = icons[index] ?? Star;
        return (
          <li key={step} className="relative rounded-xl border bg-card p-4 shadow-sm">
            <span className="absolute top-3 end-3 text-[11px] font-semibold text-muted-foreground/60" dir="ltr">
              {step}/5
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h4 className="mt-3 pe-6 text-sm font-semibold">
              {t(`home.howItWorks.${audience}.step${step}.title`)}
            </h4>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {t(`home.howItWorks.${audience}.step${step}.body`)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * "How it works" (§7) — the same five-step story told twice, once per side of
 * the marketplace. Tabs keep both versions reachable without doubling the page.
 */
export function HowItWorks() {
  const { t } = useI18n();

  return (
    <Tabs defaultValue="customer">
      <div className="flex justify-center">
        <TabsList>
          <TabsTrigger value="customer">{t("home.howItWorks.customer")}</TabsTrigger>
          <TabsTrigger value="professional">{t("home.howItWorks.professional")}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="customer" className="mt-6">
        <Steps audience="customer" icons={CUSTOMER_ICONS} />
      </TabsContent>
      <TabsContent value="professional" className="mt-6">
        <Steps audience="professional" icons={PROFESSIONAL_ICONS} />
      </TabsContent>
    </Tabs>
  );
}
