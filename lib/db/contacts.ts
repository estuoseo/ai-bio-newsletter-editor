import "server-only";
import type { Contact, Id } from "@/types";
import { db } from "./client";
import { check, unwrap } from "./errors";
import { toContact, type ContactRow } from "./rows";

export type ContactInput = { name: string; email: string; groupName?: string | null };

const toInsert = (c: ContactInput) => ({
  name: c.name,
  email: c.email.trim().toLowerCase(),
  group_name: c.groupName ?? null,
});

export async function listContacts(): Promise<Contact[]> {
  const rows = unwrap(
    await db().from("contacts").select("*").order("group_name").order("name"),
  ) as ContactRow[];
  return rows.map(toContact);
}

/** id가 있으면 수정, 없으면 추가 (M5). 이미 있는 이메일이면 DbError("duplicate") */
export async function saveContact(input: ContactInput & { id?: Id }): Promise<Contact> {
  const query = input.id
    ? db().from("contacts").update(toInsert(input)).eq("id", input.id)
    : db().from("contacts").insert(toInsert(input));
  const row = unwrap(await query.select().single());
  return toContact(row as ContactRow);
}

export async function deleteContact(id: Id): Promise<void> {
  check(await db().from("contacts").delete().eq("id", id));
}

/** CSV 가져오기 (M5). 같은 이메일은 이름·그룹만 새 값으로 바꾼다 */
export async function importContacts(contacts: ContactInput[]): Promise<number> {
  if (contacts.length === 0) return 0;
  const unique = new Map(contacts.map((c) => [toInsert(c).email, toInsert(c)]));
  const rows = unwrap<{ id: Id }[]>(
    await db()
      .from("contacts")
      .upsert([...unique.values()], { onConflict: "email" })
      .select("id"),
  );
  return rows.length;
}
