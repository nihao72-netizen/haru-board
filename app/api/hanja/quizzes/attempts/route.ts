import type { NextRequest } from "next/server";
import { ApiError, handle, ok, pagination, readJson, requireUser } from "@/lib/api/http";
import { listAttempts, parseDailySubmit, quizDbError, type GradeResult } from "@/lib/quiz";
import { isDateString } from "@/lib/validate";

/**
 * POST /api/hanja/quizzes/attempts — 일일 퀴즈 제출, 서버 채점 (PRD 8.10)
 * {"question_id","selected_option_id","request_id"} — request_id 필수.
 * 새 제출 201, 같은 request_id 재시도는 기존 결과 200. 오늘 배정 한자의 문제만 허용.
 * 정답 확인·시도 저장은 DB 함수 submit_daily_quiz()가 한 트랜잭션으로 처리한다.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const input = parseDailySubmit(await readJson(request));
    const { data, error } = await supabase.rpc("submit_daily_quiz", {
      p_question_id: input.question_id,
      p_selected_option_id: input.selected_option_id,
      p_request_id: input.request_id,
    });
    if (error) throw quizDbError(error);
    const row = (Array.isArray(data) ? data[0] : data) as (GradeResult & { attempted_at: string }) | undefined;
    if (!row) throw new ApiError(500, "INTERNAL_ERROR", "채점 결과를 받지 못했습니다.");
    return ok(row, row.is_duplicate ? 200 : 201);
  });
}

/**
 * GET /api/hanja/quizzes/attempts?type=all|daily|review&date=YYYY-MM-DD&page=1&limit=20 — 내 풀이 기록
 * 이미 푼 문제라 정답·해설도 함께 돌려준다 (본인 시도만).
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const params = request.nextUrl.searchParams;
    const { page, limit, from, to } = pagination(params);
    const type = params.get("type") ?? "all";
    if (type !== "all" && type !== "daily" && type !== "review") {
      throw new ApiError(400, "VALIDATION_ERROR", "type은 all, daily, review 중 하나여야 합니다.");
    }
    const date = params.get("date");
    if (date && !isDateString(date)) throw new ApiError(400, "VALIDATION_ERROR", "date는 YYYY-MM-DD 형식이어야 합니다.");

    const { items, total } = await listAttempts(supabase, { type, date, from, to });
    return ok({ items, page, limit, total });
  });
}
