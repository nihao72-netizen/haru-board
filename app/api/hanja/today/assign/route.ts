import { ApiError, dbError, handle, ok, requireUser } from "@/lib/api/http";
import { findLearning } from "@/lib/hanja";

type AssignRow = {
  learning_id: string | null;
  learning_date: string;
  status: string | null;
  character_id: string | null;
  is_new_assignment: boolean;
  exhausted: boolean;
};

/**
 * POST /api/hanja/today/assign — 오늘의 한자 배정 (PRD 8.10)
 * 원자적 배정은 DB 함수 assign_today_hanja()가 처리 (중복 배정·동시 요청 방지, 서울 날짜 기준).
 * 새로 배정 201, 이미 오늘 배정됨 200 (기존 결과), 준비된 한자 모두 배정됨 409.
 */
export async function POST() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("assign_today_hanja");
    if (error) throw dbError(error);
    const row = (Array.isArray(data) ? data[0] : data) as AssignRow | undefined;
    if (!row) throw new ApiError(500, "INTERNAL_ERROR", "한자를 배정하지 못했습니다.");
    if (row.exhausted || !row.learning_id) {
      throw new ApiError(409, "HANJA_EXHAUSTED", "준비된 한자를 모두 배정받았습니다. 새 한자가 추가될 때까지 지난 한자를 복습해 주세요.");
    }

    const record = await findLearning(supabase, "id", row.learning_id);
    if (!record) throw new ApiError(500, "INTERNAL_ERROR", "배정된 한자를 불러오지 못했습니다.");
    return ok({ ...record, is_new_assignment: row.is_new_assignment }, row.is_new_assignment ? 201 : 200);
  });
}
