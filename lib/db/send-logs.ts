import "server-only";
import type { Id, SendLog } from "@/types";
import { db } from "./client";
import { check, unwrap } from "./errors";
import { toSendLog, type SendLogRow } from "./rows";

/** 최근 발송이 먼저 (M10) */
export async function listSendLogs(limit = 50): Promise<SendLog[]> {
  const rows = unwrap(
    await db().from("send_logs").select("*").order("sent_at", { ascending: false }).limit(limit),
  ) as SendLogRow[];
  return rows.map(toSendLog);
}

export async function getSendLog(id: Id): Promise<SendLog> {
  const row = unwrap(await db().from("send_logs").select("*").eq("id", id).single());
  return toSendLog(row as SendLogRow);
}

/** 발송 직전에 "보내는 중"으로 먼저 기록한다. 중복 발송 확인에 쓴다 */
export async function startSendLog(input: {
  dateTabId: Id;
  subject: string;
  recipients: string[];
  articleIds: Id[];
  html: string;
}): Promise<SendLog> {
  const row = unwrap(
    await db()
      .from("send_logs")
      .insert({
        date_tab_id: input.dateTabId,
        subject: input.subject,
        recipients: input.recipients,
        article_ids: input.articleIds,
        html: input.html,
        status: "sending",
      })
      .select()
      .single(),
  );
  return toSendLog(row as SendLogRow);
}

export async function finishSendLog(
  id: Id,
  result: { status: "sent" } | { status: "failed"; error: string },
): Promise<void> {
  check(
    await db()
      .from("send_logs")
      .update({ status: result.status, error: result.status === "failed" ? result.error : null })
      .eq("id", id),
  );
}

/**
 * 같은 날짜 탭으로 최근 5분 안에 "보내는 중"인 메일이 있는지 (M9 중복 방지).
 * 발송 도중 서버가 멈춰 남은 기록이 영원히 막지 않도록 5분이 지나면 무시한다.
 */
export async function hasSendingLog(dateTabId: Id): Promise<boolean> {
  const rows = unwrap<{ id: Id }[]>(
    await db()
      .from("send_logs")
      .select("id")
      .eq("date_tab_id", dateTabId)
      .eq("status", "sending")
      .gte("sent_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .limit(1),
  );
  return rows.length > 0;
}
