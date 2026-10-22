import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { SendPage } from "@/components/send-page";
import { listContacts, listMailTemplates, listSendLogs } from "@/lib/db";
import { smtpFrom } from "@/lib/mail/send";
import { loadTab } from "@/lib/server/load";

async function Composer({ searchParams }: { searchParams: PageProps<"/send">["searchParams"] }) {
  const { tab: tabParam } = await searchParams;
  const { tabs, tab, views } = await loadTab(tabParam, { preferMail: true });
  const [contacts, templates, logs] = await Promise.all([listContacts(), listMailTemplates(), listSendLogs(20)]);
  const items = views.flatMap((v) =>
    v.article.includeInMail && v.article.status === "ready" && v.content ? [{ article: v.article, content: v.content }] : [],
  );
  return (
    <SendPage
      key={tab?.id ?? "none"}
      tabs={tabs}
      tab={tab}
      items={items}
      contacts={contacts}
      templates={templates}
      logs={logs.map(({ html, ...l }) => ({ ...l, size: html.length }))}
      smtpReady={smtpFrom() !== null}
    />
  );
}

export default function Send(props: PageProps<"/send">) {
  return (
    <>
      <Nav active="/send" />
      <main className="mx-auto max-w-7xl p-4">
        <Suspense fallback={<p className="p-8 text-center text-slate-400">불러오는 중…</p>}>
          <Composer searchParams={props.searchParams} />
        </Suspense>
      </main>
    </>
  );
}
