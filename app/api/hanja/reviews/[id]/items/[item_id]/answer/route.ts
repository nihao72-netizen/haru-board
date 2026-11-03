import type { NextRequest } from "next/server";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api/http";
import { parseOptionId, quizDbError, type GradeResult } from "@/lib/quiz";
import { requireUuid } from "@/lib/validate";

type Ctx = RouteContext<"/api/hanja/reviews/[id]/items/[item_id]/answer">;

/**
 * POST /api/hanja/reviews/{id}/items/{item_id}/answer — {"selected_option_id":"C"} (PRD 8.11)
 * 시도 저장 + 항목 완료 + 회차 상태 전환을 DB 함수 submit_review_answer()가 한 트랜잭션으로 처리.
 * 첫 제출 201. 같은 보기 재전송은 기존 결과 200(새 기록 없음). 다른 보기로 재제출 409.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const params = await ctx.params;
    const reviewId = requireUuid(params.id, "id");
    const itemId = requireUuid(params.item_id, "item_id");
    const { supabase } = await requireUser();
    const selected = parseOptionId((await readJson(request)).selected_option_id);

    const { data, error } = await supabase.rpc("submit_review_answer", {
      p_review_id: reviewId,
      p_item_id: itemId,
      p_selected_option_id: selected,
    });
    if (error) throw quizDbError(error);
    const row = (Array.isArray(data) ? data[0] : data) as
      | (GradeResult & { item_id: string; review_status: string; completed_questions: number; total_questions: number })
      | undefined;
    if (!row) throw new ApiError(500, "INTERNAL_ERROR", "채점 결과를 받지 못했습니다.");
    return ok(row, row.is_duplicate ? 200 : 201);
  });
}
