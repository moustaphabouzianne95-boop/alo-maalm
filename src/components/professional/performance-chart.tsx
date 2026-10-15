"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n/provider";

/** Completed-job revenue by month. Values are whole dirhams, never dollars. */
export function RevenueChart({ data }: { data: { label: string; value: number }[] }) {
  const { t, formatMoney } = useI18n();
  if (data.every((point) => point.value === 0)) return null;

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            formatter={(value) => [formatMoney(Number(value)), t("pro.chart.revenue")]}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ borderRadius: 12, fontSize: 12 }}
          />
          <Bar dataKey="value" fill="hsl(158 76% 30%)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
