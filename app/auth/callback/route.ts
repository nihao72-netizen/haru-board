import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * 이메일 링크(비밀번호 재설정 등)에서 돌아오는 경로.
 * PKCE code를 세션으로 교환한 뒤 next 경로로 이동한다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, origin));

  if (!code) return fail("missing_code");

  const supabase = await createClient();
  if (!supabase) return fail("not_configured");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("invalid_link");

  return NextResponse.redirect(new URL(next, origin));
}
