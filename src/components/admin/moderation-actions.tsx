"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

function useRefresh() {
  const router = useRouter();
  const { t } = useI18n();
  return {
    t,
    done() {
      toast.success(t("admin.success.generic"));
      router.refresh();
    },
    fail(error: unknown) {
      toast.error(mutationMessage(error, t));
    },
  };
}

function ReasonField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <Textarea value={value} onChange={(event) => onChange(event.target.value)} maxLength={500} placeholder={label} rows={3} />;
}

export function UserStatusActions({ userId, status, self }: { userId: string; status: string; self?: boolean }) {
  const { t, done, fail } = useRefresh();
  const [reason, setReason] = React.useState("");
  if (self) return null;

  async function setStatus(next: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") {
    await api.post(`/api/admin/users/${userId}/status`, { status: next, reason: reason.trim() || null });
    done();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "SUSPENDED" && (
        <ConfirmDialog
          variant="destructive"
          title={t("admin.confirm.suspend.title")}
          description={t("admin.confirm.suspend.body")}
          confirmLabel={t("admin.action.suspend")}
          trigger={<Button size="sm" variant="destructive">{t("admin.action.suspend")}</Button>}
          onConfirm={async () => {
            try {
              await setStatus("SUSPENDED");
            } catch (error) {
              fail(error);
              throw error;
            }
          }}
        >
          <ReasonField value={reason} onChange={setReason} label={t("admin.note.required")} />
        </ConfirmDialog>
      )}
      {status !== "ACTIVE" && (
        <ConfirmDialog
          title={t("admin.confirm.activate.title")}
          description={t("admin.confirm.activate.body")}
          confirmLabel={t("admin.action.activate")}
          trigger={<Button size="sm">{t("admin.action.activate")}</Button>}
          onConfirm={async () => {
            try {
              await setStatus("ACTIVE");
            } catch (error) {
              fail(error);
              throw error;
            }
          }}
        />
      )}
    </div>
  );
}

export function PasswordResetButton({ userId }: { userId: string }) {
  const { t, fail } = useRefresh();
  const [password, setPassword] = React.useState<string | null>(null);

  return (
    <div className="space-y-2">
      <ConfirmDialog
        variant="destructive"
        title={t("admin.password.title")}
        description={t("admin.password.body")}
        confirmLabel={t("admin.password.title")}
        trigger={<Button size="sm" variant="outline">{t("admin.password.title")}</Button>}
        onConfirm={async () => {
          try {
            const result = await api.post<{ temporaryPassword: string }>(`/api/admin/users/${userId}/reset-password`);
            setPassword(result.temporaryPassword);
          } catch (error) {
            fail(error);
            throw error;
          }
        }}
      />
      {password && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm">
          <span className="block text-xs text-muted-foreground">{t("admin.password.once")}</span>
          <span className="font-mono font-semibold">{password}</span>
        </p>
      )}
    </div>
  );
}

export function VerificationActions({ profileId, status }: { profileId: string; status: string }) {
  const { t, done, fail } = useRefresh();
  const [reason, setReason] = React.useState("");

  async function setVerification(next: "VERIFIED" | "REJECTED" | "SUSPENDED" | "PENDING") {
    await api.post(`/api/admin/professionals/${profileId}/verification`, {
      verificationStatus: next,
      reason: reason.trim() || null,
      method: "MANUAL",
    });
    done();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "VERIFIED" && (
        <ConfirmDialog
          title={t("admin.confirm.verify.title")}
          description={t("admin.confirm.verify.body")}
          confirmLabel={t("admin.action.verify")}
          trigger={<Button size="sm">{t("admin.action.verify")}</Button>}
          onConfirm={async () => {
            try {
              await setVerification("VERIFIED");
            } catch (error) {
              fail(error);
              throw error;
            }
          }}
        />
      )}
      {status !== "REJECTED" && (
        <ConfirmDialog
          variant="destructive"
          title={t("admin.confirm.reject.title")}
          description={t("admin.confirm.reject.body")}
          confirmLabel={t("admin.action.reject")}
          trigger={<Button size="sm" variant="outline">{t("admin.action.reject")}</Button>}
          onConfirm={async () => {
            try {
              await setVerification("REJECTED");
            } catch (error) {
              fail(error);
              throw error;
            }
          }}
        >
          <ReasonField value={reason} onChange={setReason} label={t("admin.note.required")} />
        </ConfirmDialog>
      )}
    </div>
  );
}

export function FeatureButton({ profileId, featured }: { profileId: string; featured: boolean }) {
  const { t, done, fail } = useRefresh();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() =>
        api
          .post(`/api/admin/professionals/${profileId}/featured`, { isFeatured: !featured })
          .then(done)
          .catch(fail)
      }
    >
      {t(featured ? "admin.action.unfeature" : "admin.action.feature")}
    </Button>
  );
}

export function ServiceModeration({ id, status }: { id: string; status: string }) {
  const { t, done, fail } = useRefresh();
  const [reason, setReason] = React.useState("");
  if (status === "HIDDEN") {
    return (
      <Button size="sm" variant="outline" onClick={() => api.post(`/api/admin/services/${id}/unhide`).then(done).catch(fail)}>
        {t("admin.action.showService")}
      </Button>
    );
  }
  return (
    <ConfirmDialog
      variant="destructive"
      title={t("admin.confirm.hideService.title")}
      description={t("admin.confirm.hideService.body")}
      confirmLabel={t("admin.action.hideService")}
      trigger={<Button size="sm" variant="outline">{t("admin.action.hideService")}</Button>}
      onConfirm={async () => {
        try {
          await api.post(`/api/admin/services/${id}/hide`, { reason: reason.trim() || null });
          done();
        } catch (error) {
          fail(error);
          throw error;
        }
      }}
    >
      <ReasonField value={reason} onChange={setReason} label={t("admin.verification.note")} />
    </ConfirmDialog>
  );
}

export function ReviewModeration({ id, status }: { id: string; status: string }) {
  const { t, done, fail } = useRefresh();
  const [reason, setReason] = React.useState("");
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "HIDDEN" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => api.patch(`/api/admin/reviews/${id}`, { status: "HIDDEN", reason: reason || null }).then(done).catch(fail)}
        >
          {t("admin.action.hideReview")}
        </Button>
      )}
      {status !== "PUBLISHED" && (
        <Button size="sm" variant="outline" onClick={() => api.patch(`/api/admin/reviews/${id}`, { status: "PUBLISHED" }).then(done).catch(fail)}>
          {t("admin.action.showService")}
        </Button>
      )}
      <ConfirmDialog
        variant="destructive"
        title={t("admin.confirm.deleteReview.title")}
        description={t("admin.confirm.deleteReview.body")}
        confirmLabel={t("admin.action.deleteReview")}
        trigger={<Button size="sm" variant="ghost">{t("common.delete")}</Button>}
        onConfirm={async () => {
          try {
            await api.patch(`/api/admin/reviews/${id}`, { delete: true, reason: reason.trim() || "Removed by moderation" });
            done();
          } catch (error) {
            fail(error);
            throw error;
          }
        }}
      >
        <ReasonField value={reason} onChange={setReason} label={t("admin.note.required")} />
      </ConfirmDialog>
    </div>
  );
}

export function ReportActions({ id, status }: { id: string; status: string }) {
  const { t, done, fail } = useRefresh();
  const [resolution, setResolution] = React.useState("");
  const closed = status === "RESOLVED" || status === "DISMISSED";

  async function move(next: "INVESTIGATING" | "RESOLVED" | "DISMISSED" | "OPEN") {
    await api.patch(`/api/admin/reports/${id}`, { status: next, resolution: resolution.trim() || null });
    done();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "OPEN" && (
        <Button size="sm" variant="outline" onClick={() => move("INVESTIGATING").catch(fail)}>
          {t("admin.action.investigate")}
        </Button>
      )}
      {!closed && (
        <>
          <ConfirmDialog
            title={t("admin.action.resolveReport")}
            description={t("admin.note.required")}
            confirmLabel={t("admin.action.resolveReport")}
            trigger={<Button size="sm">{t("admin.action.resolveReport")}</Button>}
            onConfirm={async () => {
              try {
                await move("RESOLVED");
              } catch (error) {
                fail(error);
                throw error;
              }
            }}
          >
            <ReasonField value={resolution} onChange={setResolution} label={t("admin.verification.note")} />
          </ConfirmDialog>
          <ConfirmDialog
            variant="destructive"
            title={t("admin.action.dismissReport")}
            confirmLabel={t("admin.action.dismissReport")}
            trigger={<Button size="sm" variant="outline">{t("admin.action.dismissReport")}</Button>}
            onConfirm={async () => {
              try {
                await move("DISMISSED");
              } catch (error) {
                fail(error);
                throw error;
              }
            }}
          >
            <ReasonField value={resolution} onChange={setResolution} label={t("admin.verification.note")} />
          </ConfirmDialog>
        </>
      )}
      {status === "DISMISSED" && (
        <Button size="sm" variant="outline" onClick={() => move("OPEN").catch(fail)}>
          {t("reports.status.OPEN")}
        </Button>
      )}
    </div>
  );
}

export function CategoryToggle({ id, active }: { id: string; active: boolean }) {
  const { t, done, fail } = useRefresh();
  return (
    <Button size="sm" variant="outline" onClick={() => api.post(`/api/admin/categories/${id}`, { isActive: !active }).then(done).catch(fail)}>
      {active ? t("admin.action.deactivate") : t("admin.action.activate")}
    </Button>
  );
}

export function CategoryCreateForm() {
  const { t, done, fail } = useRefresh();
  const [name, setName] = React.useState("");
  const [nameFr, setNameFr] = React.useState("");
  const [nameEn, setNameEn] = React.useState("");
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="grid gap-2 sm:grid-cols-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        try {
          await api.post("/api/admin/categories", {
            name: name.trim(),
            nameFr: nameFr.trim() || null,
            nameEn: nameEn.trim() || null,
          });
          setName("");
          setNameFr("");
          setNameEn("");
          done();
        } catch (error) {
          fail(error);
        } finally {
          setPending(false);
        }
      }}
    >
      <input
        required
        minLength={2}
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("admin.categories")}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      />
      <input
        value={nameFr}
        onChange={(event) => setNameFr(event.target.value)}
        placeholder="Français"
        className="h-9 rounded-md border bg-background px-3 text-sm"
      />
      <input
        value={nameEn}
        onChange={(event) => setNameEn(event.target.value)}
        placeholder="English"
        className="h-9 rounded-md border bg-background px-3 text-sm"
      />
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {t("common.add")}
      </Button>
    </form>
  );
}

export function ClearRateLimitsButton() {
  const { t, fail } = useRefresh();
  const router = useRouter();
  return (
    <ConfirmDialog
      variant="destructive"
      title={t("admin.rateLimit.title")}
      description={t("admin.rateLimit.body")}
      confirmLabel={t("admin.rateLimit.title")}
      trigger={<Button variant="outline">{t("admin.rateLimit.title")}</Button>}
      onConfirm={async () => {
        try {
          await api.post("/api/admin/rate-limit");
          toast.success(t("admin.rateLimit.done"));
          router.refresh();
        } catch (error) {
          fail(error);
          throw error;
        }
      }}
    />
  );
}
