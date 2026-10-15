"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n/provider";

export function AdminBarChart({
  data,
  label,
  money = false,
}: {
  data: { label: string; value: number }[];
  label: string;
  money?: boolean;
}) {
  const { formatMoney, formatNumber } = useI18n();
  if (!data.length || data.every((point) => point.value === 0)) return null;
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            formatter={(value) => [money ? formatMoney(Number(value)) : formatNumber(Number(value)), label]}
            contentStyle={{ borderRadius: 12, fontSize: 12 }}
          />
          <Bar dataKey="value" fill="hsl(158 76% 30%)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
