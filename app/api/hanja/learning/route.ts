import type { NextRequest } from "next/server";
import { dbError, handle, ok, pagination, requireUser } from "@/lib/api/http";
import { LEARNING_SELECT, toLearningRecord, type LearningRow } from "@/lib/hanja";

/** GET /api/hanja/learning?page=1&limit=20 — 내 한자 학습 기록 (최근 배정 순) */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const { page, limit, from, to } = pagination(request.nextUrl.searchParams);
    const { data, error, count } = await supabase
      .from("hanja_learning")
      .select(LEARNING_SELECT, { count: "exact" })
      .order("learning_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);
    const meta = { page, limit, total: count ?? 0 };
    if (error) {
      if (error.code === "PGRST103") return ok({ items: [], ...meta });
      throw dbError(error);
    }
    const rows = (data ?? []) as unknown as LearningRow[];
    return ok({ items: rows.map(toLearningRecord), ...meta });
  });
}
