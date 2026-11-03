import type { NextRequest } from "next/server";
import { handle, ok, requireUser } from "@/lib/api/http";
import { loadAttempts, loadReview, type ReviewSummary } from "@/lib/quiz";
import { requireUuid } from "@/lib/validate";

/**
 * GET /api/hanja/reviews/{id}/summary — PRD 8.11
 * total_questions, completed_questions, correct_count, incorrect_count, accuracy_rate, status
 * 정답률은 완료한 문항 기준. 완료 문항이 없으면(문제 0개 회차 포함) null.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/hanja/reviews/[id]/summary">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const { review, items } = await loadReview(supabase, id);
    const attempts = await loadAttempts(
      supabase,
      items.map((i) => i.quiz_attempt_id).filter((x): x is string => !!x),
    );

    const completed = items.filter((i) => i.status === "completed");
    const correct = completed.filter((i) => i.quiz_attempt_id && attempts.get(i.quiz_attempt_id)?.is_correct).length;
    const summary: ReviewSummary = {
      review_id: review.id,
      review_week: review.review_week,
      status: review.status,
      total_questions: items.length,
      completed_questions: completed.length,
      correct_count: correct,
      incorrect_count: completed.length - correct,
      accuracy_rate: completed.length === 0 ? null : Math.round((correct / completed.length) * 1000) / 10,
    };
    return ok(summary);
  });
}
