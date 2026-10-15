"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

export interface ConfirmDialogProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  /** `destructive` renders a red confirm button and a warning icon. */
  variant?: "default" | "destructive";
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Optional extra body content (e.g. a "reason" textarea). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Destructive-action gate required by §24. Keeps its own pending state so the
 * dialog cannot be double-submitted while the mutation is in flight.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = "default",
  trigger,
  open: controlledOpen,
  onOpenChange,
  disabled,
  children,
  className,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  async function handleConfirm(event: React.MouseEvent) {
    event.preventDefault();
    if (pending || disabled) return;
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  const Trigger = trigger
    ? AlertDialogTrigger
    : (props: React.ComponentPropsWithoutRef<typeof AlertDialogTrigger>) => <span {...props} />;

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      {trigger ? <AlertDialogTrigger asChild disabled={disabled}>{trigger}</AlertDialogTrigger> : <Trigger />}
      <AlertDialogContent className={cn("max-w-md", className)}>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            {variant === "destructive" && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-200" aria-hidden>
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            <div className="space-y-1.5 text-start">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
            </div>
          </div>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel ?? t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending || disabled}
            className={cn(
              variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
            )}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {confirmLabel ?? t("common.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
