"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

export function ReviewReplyForm({ reviewId, initial }: { reviewId: string; initial?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [reply, setReply] = React.useState(initial ?? "");
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        try {
          await api.post(`/api/reviews/${reviewId}/reply`, { reply: reply.trim() });
          toast.success(t("reviews.replyPosted"));
          router.refresh();
        } catch (error) {
          toast.error(mutationMessage(error, t));
        } finally {
          setPending(false);
        }
      }}
    >
      <Textarea
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t("reviews.replyPlaceholder")}
        aria-label={t("reviews.reply")}
      />
      <Button type="submit" size="sm" disabled={pending || reply.trim().length < 3}>
        {t("reviews.reply")}
      </Button>
    </form>
  );
}
