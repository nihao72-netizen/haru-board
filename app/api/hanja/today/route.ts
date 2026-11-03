import { handle, ok, requireUser } from "@/lib/api/http";
import { todayKST } from "@/lib/date";
import { findLearning } from "@/lib/hanja";

/** GET /api/hanja/today — 오늘(서울) 배정된 한자 조회만. 없으면 data: null (배정은 POST /api/hanja/today/assign) */
export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    return ok(await findLearning(supabase, "learning_date", todayKST()));
  });
}
