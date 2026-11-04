import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, ok, requireUser } from "@/lib/api/http";
import { parseDateParam, type DiaryWithContent } from "@/lib/daily";

/**
 * GET /api/daily-reviews/content?date=YYYY-MM-DD — 그날 일기 본문.
 * DB 함수 read_diary가 '최근 10분 안에 비밀번호로 다시 로그인한 세션'인지 확인한다.
 * 아니면 403 REAUTH_REQUIRED, 일기가 없으면 404.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const raw = request.nextUrl.searchParams.get("date");
    if (!raw) throw new ApiError(400, "VALIDATION_ERROR", "날짜(date)가 필요합니다.");
    const date = parseDateParam(raw, raw);
    const { data, error } = await supabase.rpc("read_diary", { p_date: date });
    if (error) throw dbError(error);
    const row = (Array.isArray(data) ? data[0] : data) as DiaryWithContent | undefined;
    if (!row) throw new ApiError(404, "NOT_FOUND", "그날 작성한 일기가 없습니다.");
    return ok(row);
  });
}
