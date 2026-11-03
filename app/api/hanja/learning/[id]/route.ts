import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, ok, readJson, requireUser } from "@/lib/api/http";
import { findLearning, parseLearningStatus } from "@/lib/hanja";
import { requireUuid } from "@/lib/validate";

/**
 * PATCH /api/hanja/learning/{id} — {"status":"studying"} 또는 {"status":"completed"} (PRD 4.5)
 * 전환 규칙(assigned → studying → completed, 역행 금지)과 completed_at 기록은 DB 트리거가 강제한다.
 * 같은 상태로 다시 보내면 변경 없이 200.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/hanja/learning/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const status = parseLearningStatus((await readJson(request)).status);

    const { data, error } = await supabase.from("hanja_learning").update({ status }).eq("id", id).select("id").maybeSingle();
    if (error) {
      if (error.code === "HB409") {
        throw new ApiError(
          409,
          "INVALID_STATUS_TRANSITION",
          "학습 상태는 '배정 → 학습 중 → 완료' 순서로만 바꿀 수 있습니다. 학습을 시작한 뒤 완료해 주세요.",
        );
      }
      throw dbError(error);
    }
    if (!data) throw new ApiError(404, "NOT_FOUND", "학습 기록을 찾을 수 없습니다.");

    return ok(await findLearning(supabase, "id", id));
  });
}
