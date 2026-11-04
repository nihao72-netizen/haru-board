import type { NextRequest } from "next/server";
import { dbError, handle, ok, pagination, requireUser } from "@/lib/api/http";
import { DAILY_REVIEW_COLUMNS } from "@/lib/daily";

/**
 * GET /api/daily-reviews/list?page=1&limit=10 — 내 일기 목록 (최근 날짜부터, 날짜·제목만)
 * 본문은 포함하지 않는다. 본문은 GET /api/daily-reviews/content (비밀번호 재확인 필요)
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const { page, limit, from, to } = pagination(request.nextUrl.searchParams, 50, 10);
    const { data, error, count } = await supabase
      .from("daily_reviews")
      .select(DAILY_REVIEW_COLUMNS, { count: "exact" })
      .order("review_date", { ascending: false })
      .range(from, to);
    const meta = { page, limit, total: count ?? 0 };
    if (error) {
      if (error.code === "PGRST103") return ok({ items: [], ...meta });
      throw dbError(error);
    }
    return ok({ items: data ?? [], ...meta });
  });
}
