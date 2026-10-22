import type { PostgrestError } from "@supabase/supabase-js";

export type DbErrorCode = "duplicate" | "not_found" | "invalid" | "unknown";

/** 화면에서 이유별로 다른 안내를 보여줄 수 있게 DB 오류를 종류별로 나눈다 (DESIGN §8) */
export class DbError extends Error {
  constructor(
    public code: DbErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DbError";
  }
}

const PG_CODES: Record<string, DbErrorCode> = {
  "23505": "duplicate",
  "23503": "invalid",
  "23514": "invalid",
  "22P02": "invalid",
  PGRST116: "not_found",
};

export function toDbError(error: PostgrestError): DbError {
  return new DbError(PG_CODES[error.code] ?? "unknown", error.message);
}

/**
 * Supabase 응답에서 데이터를 꺼내고, 오류면 DbError로 던진다.
 * DB 타입을 따로 생성하지 않았으므로 결과는 unknown이고, 호출하는 쪽에서 rows.ts의 Row 타입으로 지정한다.
 */
export function unwrap<T = unknown>({ data, error }: { data: unknown; error: PostgrestError | null }): T {
  if (error) throw toDbError(error);
  if (data === null) throw new DbError("not_found", "데이터를 찾을 수 없습니다.");
  return data as T;
}

/** 없을 수도 있는 한 건을 읽을 때 (maybeSingle). 없으면 null */
export function unwrapMaybe<T>({ data, error }: { data: unknown; error: PostgrestError | null }): T | null {
  if (error) throw toDbError(error);
  return (data ?? null) as T | null;
}

/** 지우기·수정처럼 돌려받을 데이터가 없는 요청용 */
export function check({ error }: { error: PostgrestError | null }): void {
  if (error) throw toDbError(error);
}
