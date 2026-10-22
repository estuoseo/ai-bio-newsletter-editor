import "server-only";
import type { DateString, DateTab, Id } from "@/types";
import { db } from "./client";
import { check, unwrap } from "./errors";
import { toDateTab, type DateTabRow } from "./rows";

/** 최신 날짜가 먼저 (F1) */
export async function listDateTabs(): Promise<DateTab[]> {
  const rows = unwrap(
    await db()
      .from("date_tabs")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  );
  return (rows as DateTabRow[]).map(toDateTab);
}

export async function getDateTab(id: Id): Promise<DateTab> {
  const row = unwrap(await db().from("date_tabs").select("*").eq("id", id).single());
  return toDateTab(row as DateTabRow);
}

export async function createDateTab(input: {
  date: DateString;
  endDate?: DateString | null;
  label: string;
}): Promise<DateTab> {
  const row = unwrap(
    await db()
      .from("date_tabs")
      .insert({ date: input.date, end_date: input.endDate ?? null, label: input.label })
      .select()
      .single(),
  );
  return toDateTab(row as DateTabRow);
}

export async function updateDateTab(
  id: Id,
  patch: { date?: DateString; endDate?: DateString | null; label?: string },
): Promise<DateTab> {
  const row = unwrap(
    await db()
      .from("date_tabs")
      .update({ date: patch.date, end_date: patch.endDate, label: patch.label })
      .eq("id", id)
      .select()
      .single(),
  );
  return toDateTab(row as DateTabRow);
}

/** 탭 안의 기사·요약도 함께 지워진다. 발송 이력은 남는다 */
export async function deleteDateTab(id: Id): Promise<void> {
  check(await db().from("date_tabs").delete().eq("id", id));
}
