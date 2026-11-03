import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let browserClient: SupabaseClient | null = null;

/**
 * 브라우저용 Supabase 클라이언트.
 * 환경변수가 없으면 null을 반환하므로 호출하는 쪽에서 안내 메시지를 보여줘야 한다.
 */
export function createClient(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(env.url, env.anonKey);
  }
  return browserClient;
}
