"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { notificationIcon, notificationTone } from "@/lib/notifications/types";
import { DynamicIcon } from "@/components/shared/dynamic-icon";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkTo: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationPage {
  items: NotificationRow[];
  unreadTotal: number;
  total: number;
}

/**
 * Notification bell (§18).
 *
 * Polls the unread counter every 30 s so the badge stays live without a socket,
 * and marks notifications read optimistically — the counter drops immediately
 * and rolls back if the request fails.
 */
export function NotificationBell({ role }: { role: "CUSTOMER" | "PROFESSIONAL" | "ADMIN" }) {
  const { t, formatRelative } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const listPath = role === "PROFESSIONAL" ? "/professional/notifications" : role === "ADMIN" ? "/admin/notifications" : "/dashboard/notifications";

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "latest"],
    queryFn: async (): Promise<NotificationPage> => {
      // The route returns the rows as `data` and unread/total as `meta`.
      // Older callers expected `{ items }` inside `data`. Accept both, and never
      // read `.length` on a missing array — that crashed the dashboard after login.
      const envelope = await api.getWithMeta<NotificationRow[] | NotificationPage>("/api/notifications?perPage=8");
      const payload = envelope.data;
      const meta = envelope.meta ?? {};
      if (payload && !Array.isArray(payload) && Array.isArray(payload.items)) {
        return {
          items: payload.items,
          unreadTotal: payload.unreadTotal ?? Number(meta.unreadTotal ?? 0),
          total: payload.total ?? Number(meta.total ?? payload.items.length),
        };
      }
      const items = Array.isArray(payload) ? payload : [];
      return {
        items,
        unreadTotal: Number(meta.unreadTotal ?? 0),
        total: Number(meta.total ?? items.length),
      };
    },
    refetchInterval: open ? 15_000 : 30_000,
  });

  const markAll = useMutation({
    mutationFn: () => api.post<{ count: number }>("/api/notifications/read-all"),
    // Optimistic: clear the badge the instant the user clicks.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "latest"] });
      const previous = queryClient.getQueryData<NotificationPage>(["notifications", "latest"]);
      if (previous) {
        queryClient.setQueryData<NotificationPage>(["notifications", "latest"], {
          ...previous,
          unreadTotal: 0,
          items: (previous.items ?? []).map((item) => ({ ...item, isRead: true })),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["notifications", "latest"], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const unread = data?.unreadTotal ?? 0;
  const items = data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-10 w-10 p-0" aria-label={t("nav.notifications")}>
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 ? (
            <span
              className={cn(
                "absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1",
                "text-[10px] font-bold leading-none text-destructive-foreground"
              )}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 p-3">
          <p className="text-sm font-semibold">{t("nav.notifications")}</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              {t("notifications.markAllRead")}
            </Button>
          ) : null}
        </div>
        <Separator />
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-8 w-8" aria-hidden />}
              title={t("notifications.empty.title")}
              description={t("notifications.empty.body")}
              className="py-10"
            />
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const icon = notificationIcon(item.type);
                const tone = notificationTone(item.type);
                const content = (
                  <div className="flex gap-3 p-3 transition-colors hover:bg-muted/60">
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        tone === "brand" && "bg-primary/10 text-primary",
                        tone === "success" && "bg-emerald-500/10 text-emerald-600",
                        tone === "warning" && "bg-amber-500/10 text-amber-600",
                        tone === "danger" && "bg-destructive/10 text-destructive",
                        tone === "muted" && "bg-muted text-muted-foreground"
                      )}
                    >
                      <DynamicIcon name={icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("truncate text-sm", item.isRead ? "font-medium text-muted-foreground" : "font-semibold")}>
                          {item.title}
                        </p>
                        {!item.isRead ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
                      </div>
                      {item.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p> : null}
                      <p className="mt-1 text-[11px] text-muted-foreground/80">{formatRelative(item.createdAt)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={item.id}>
                    {item.linkTo ? (
                      <Link href={item.linkTo} onClick={() => setOpen(false)} className="block">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center text-xs">
            <Link href={listPath} onClick={() => setOpen(false)}>
              {t("notifications.page.title")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
