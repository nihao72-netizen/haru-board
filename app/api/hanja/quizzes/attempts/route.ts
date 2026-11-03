import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, ok, pagination, readJson, requireUser } from "@/lib/api/http";
import { addDays } from "@/lib/date";
import {
  loadAnswers,
  loadQuestions,
  optionText,
  parseDailySubmit,
  quizDbError,
  type AttemptRecord,
  type GradeResult,
  type OptionId,
} from "@/lib/quiz";
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

    let query = supabase
      .from("quiz_attempts")
      .select("id, question_id, selected_option_id, is_correct, attempt_type, attempted_at", { count: "exact" });
    const type = params.get("type") ?? "all";
    if (type === "daily" || type === "review") query = query.eq("attempt_type", type);
    else if (type !== "all") throw new ApiError(400, "VALIDATION_ERROR", "type은 all, daily, review 중 하나여야 합니다.");
    const date = params.get("date");
    if (date) {
      if (!isDateString(date)) throw new ApiError(400, "VALIDATION_ERROR", "date는 YYYY-MM-DD 형식이어야 합니다.");
      query = query.gte("attempted_at", `${date}T00:00:00+09:00`).lt("attempted_at", `${addDays(date, 1)}T00:00:00+09:00`);
    }

    const { data, error, count } = await query
      .order("attempted_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);
    const meta = { page, limit, total: count ?? 0 };
    if (error) {
      if (error.code === "PGRST103") return ok({ items: [], ...meta });
      throw dbError(error);
    }
    const rows = (data ?? []) as {
      id: string;
      question_id: string;
      selected_option_id: OptionId;
      is_correct: boolean;
      attempt_type: "daily" | "review";
      attempted_at: string;
    }[];

    const [{ questions, characters }, answers] = await Promise.all([
      loadQuestions(supabase, [...new Set(rows.map((r) => r.question_id))]),
      loadAnswers(supabase, rows.map((r) => r.id)),
    ]);

    const items: AttemptRecord[] = rows.map((r) => {
      const q = questions.get(r.question_id);
      const a = answers.get(r.id);
      return {
        attempt_id: r.id,
        attempt_type: r.attempt_type,
        attempted_at: r.attempted_at,
        question_id: r.question_id,
        question: q?.question_text ?? "",
        question_type: q?.question_type ?? "reading",
        character: (q && characters.get(q.character_id)) ?? null,
        selected_option_id: r.selected_option_id,
        selected_answer: optionText(q, r.selected_option_id),
        is_correct: r.is_correct,
        correct_option_id: a?.correct_option_id ?? null,
        correct_answer: a?.correct_answer ?? null,
        explanation: a?.explanation ?? null,
      };
    });
    return ok({ items, ...meta });
  });
}
