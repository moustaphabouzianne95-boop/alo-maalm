import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { UrlSearch } from "@/components/dashboard/url-search";
import { ConversationList, toConversationItem } from "@/components/messages/conversation-list";
import { CheckboxFilter } from "@/components/shared/filter-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spBool, spOptionalString, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listConversations } from "@/server/messaging/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "messages.page.title") };
}

export default async function ProfessionalMessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/messages");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const result = await listConversations({
    actorId: session.user.id,
    search: spOptionalString(sp.search),
    unreadOnly: spBool(sp.unread),
    page: spPage(sp.page),
    perPage: 20,
  });
  const items = result.items.map((row) => toConversationItem(row, session.user.id));

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("messages.page.title")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <UrlSearch placeholder={t("messages.search.placeholder")} className="sm:max-w-xs sm:flex-1" />
        <CheckboxFilter param="unread" label={t("common.unread")} />
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-6 w-6" />} title={t("messages.empty.list.title")} description={t("messages.empty.list.body")} />
      ) : (
        <ConversationList items={items} locale={locale} basePath="/professional/messages" />
      )}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        perPage={result.perPage}
        locale={locale}
        hrefFor={(next) => buildPageHref("/professional/messages", sp, next)}
      />
    </div>
  );
}
