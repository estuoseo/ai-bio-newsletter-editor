// Design Ref: §5, §9 — DB에는 서버에서 service_role 키로만 접속한다.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/server/env";

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
