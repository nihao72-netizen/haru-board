import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * 서버용 Supabase 클라이언트 (Route Handler, Server Action, Server Component).
 * 요청마다 새로 만들어야 한다. 환경변수가 없으면 null.
 *
 * 주의: cacheComponents가 켜져 있으므로 Server Component에서 호출할 때는
 * 반드시 <Suspense> 경계 안에서 호출해야 빌드 오류가 나지 않는다.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts가 처리한다.
        }
      },
    },
  });
}
