import { handle, ok, requireUser } from "@/lib/api/http";
import { quizDbError, type ReviewInfo } from "@/lib/quiz";

/**
 * POST /api/hanja/reviews/prepare — 이미 끝난 주 중 아직 없는 복습 회차를 만들고, 전체 회차를 돌려준다 (PRD 8.11)
 * 첫 학습일이 속한 주부터 생성. 기존 회차는 그대로 재사용(문항 고정). 문제 0개 회차는 바로 completed.
 * 생성은 DB 함수 prepare_weekly_reviews()가 한 트랜잭션으로 처리한다.
 * 응답: [{ review_id, review_week, source_start_date, source_end_date, total_questions, completed_questions, status, is_new }]
 */
export async function POST() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("prepare_weekly_reviews");
    if (error) throw quizDbError(error);
    return ok((data ?? []) as (ReviewInfo & { is_new: boolean })[]);
  });
}
