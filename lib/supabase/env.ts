// Supabase 공개 환경변수. 값이 없으면 null을 반환해 Supabase 없이도 화면이 렌더링되게 한다.
export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** NEXT_PUBLIC_ 값은 빌드 시점에 고정되므로 모듈 수준 상수로 써도 된다. */
export const isSupabaseConfigured = getSupabaseEnv() !== null;

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase 환경변수가 설정되지 않았습니다. 관리자에게 문의하세요.";
