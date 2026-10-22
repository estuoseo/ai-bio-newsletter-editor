import "server-only";
import type { Id, MailTemplate } from "@/types";
import { db } from "./client";
import { check, unwrap, unwrapMaybe } from "./errors";
import { toMailTemplate, type MailTemplateRow } from "./rows";

export async function listMailTemplates(): Promise<MailTemplate[]> {
  const rows = unwrap(
    await db().from("mail_templates").select("*").order("is_default", { ascending: false }).order("name"),
  ) as MailTemplateRow[];
  return rows.map(toMailTemplate);
}

/** 기본 템플릿이 없으면 null */
export async function getDefaultMailTemplate(): Promise<MailTemplate | null> {
  const row = unwrapMaybe<MailTemplateRow>(
    await db().from("mail_templates").select("*").eq("is_default", true).maybeSingle(),
  );
  return row ? toMailTemplate(row) : null;
}

/** id가 있으면 수정, 없으면 추가 (M1, M2). 기본으로 지정하면 기존 기본 템플릿은 해제된다 */
export async function saveMailTemplate(
  input: Omit<MailTemplate, "id"> & { id?: Id },
): Promise<MailTemplate> {
  if (input.isDefault) {
    let unset = db().from("mail_templates").update({ is_default: false }).eq("is_default", true);
    if (input.id) unset = unset.neq("id", input.id);
    check(await unset);
  }
  const values = {
    name: input.name,
    subject: input.subject,
    greeting: input.greeting,
    closing: input.closing,
    is_default: input.isDefault,
  };
  const query = input.id
    ? db().from("mail_templates").update(values).eq("id", input.id)
    : db().from("mail_templates").insert(values);
  const row = unwrap(await query.select().single());
  return toMailTemplate(row as MailTemplateRow);
}

export async function deleteMailTemplate(id: Id): Promise<void> {
  check(await db().from("mail_templates").delete().eq("id", id));
}
