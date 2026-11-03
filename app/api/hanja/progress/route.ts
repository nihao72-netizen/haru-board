import { dbError, handle, ok, requireUser } from "@/lib/api/http";
import type { HanjaProgress } from "@/lib/hanja";

/** GET /api/hanja/progress — 배정/학습 상태/풀이 시도/정답률 통계 (PRD 8.10). 조회 전용 */
export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();

    const head = { count: "exact" as const, head: true };
    const learning = (status?: string) => {
      const q = supabase.from("hanja_learning").select("id", head);
      return status ? q.eq("status", status) : q;
    };
    const attempts = () => supabase.from("quiz_attempts").select("id", head);

    const results = await Promise.all([
      supabase.from("hanja_characters").select("id", head),
      learning(),
      learning("studying"),
      learning("completed"),
      attempts(),
      attempts().eq("is_correct", true),
      attempts().eq("attempt_type", "daily"),
      supabase.from("hanja_learning").select("learning_date").order("learning_date", { ascending: true }).limit(1),
    ]);
    for (const r of results) if (r.error) throw dbError(r.error);
    const [chars, assigned, studying, completed, total, correct, daily, first] = results;

    const n = (r: { count: number | null }) => r.count ?? 0;
    const totalAttempts = n(total);
    const correctAttempts = n(correct);
    const progress: HanjaProgress = {
      total_characters: n(chars),
      assigned_count: n(assigned),
      studying_count: n(studying),
      completed_count: n(completed),
      remaining_count: Math.max(0, n(chars) - n(assigned)),
      first_learning_date: (first.data as { learning_date: string }[] | null)?.[0]?.learning_date ?? null,
      attempts: {
        total: totalAttempts,
        correct: correctAttempts,
        incorrect: totalAttempts - correctAttempts,
        daily: n(daily),
        review: totalAttempts - n(daily),
        accuracy_rate: totalAttempts === 0 ? null : Math.round((correctAttempts / totalAttempts) * 1000) / 10,
      },
    };
    return ok(progress);
  });
}
