import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { SettingsPage } from "@/components/settings-page";
import { listContacts, listMailTemplates } from "@/lib/db";
import { maskEmail, smtpConfig } from "@/lib/server/env";

async function Settings() {
  const [contacts, templates] = await Promise.all([listContacts(), listMailTemplates()]);
  const smtp = smtpConfig();
  return (
    <SettingsPage
      contacts={contacts}
      templates={templates}
      // 계정·보내는 주소는 가려서 브라우저로 보낸다
      smtp={smtp && { host: smtp.host, port: smtp.port, secure: smtp.secure, user: maskEmail(smtp.user), from: maskEmail(smtp.from) }}
    />
  );
}

export default function SettingsRoute() {
  return (
    <>
      <Nav active="/settings" />
      <main className="mx-auto max-w-4xl p-4">
        <Suspense fallback={<p className="p-8 text-center text-slate-400">불러오는 중…</p>}>
          <Settings />
        </Suspense>
      </main>
    </>
  );
}
