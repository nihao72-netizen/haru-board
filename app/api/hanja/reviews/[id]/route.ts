import type { NextRequest } from "next/server";
import { handle, ok, requireUser } from "@/lib/api/http";
import { loadAnswers, loadAttempts, loadQuestions, loadReview, toQuizQuestion, toReviewInfo, type ReviewItem } from "@/lib/quiz";
import { requireUuid } from "@/lib/validate";

/**
 * GET /api/hanja/reviews/{id} — 복습 회차 상세 (PRD 8.11)
 * 미완료 문항은 문제와 보기만(정답 제외), 완료 문항은 채점 결과까지. 진행률 포함.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/hanja/reviews/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const { review, items } = await loadReview(supabase, id);

    const attemptIds = items.map((i) => i.quiz_attempt_id).filter((x): x is string => !!x);
    const [{ questions, characters }, attempts, answers] = await Promise.all([
      loadQuestions(supabase, items.map((i) => i.question_id)),
      loadAttempts(supabase, attemptIds),
      loadAnswers(supabase, attemptIds),
    ]);

    const list: ReviewItem[] = items.flatMap((i) => {
      const q = questions.get(i.question_id);
      if (!q) return [];
      const a = i.quiz_attempt_id ? attempts.get(i.quiz_attempt_id) : undefined;
      const ans = i.quiz_attempt_id ? answers.get(i.quiz_attempt_id) : undefined;
      return [
        {
          ...toQuizQuestion(q),
          item_id: i.id,
          status: i.status,
          character: characters.get(q.character_id) ?? null,
          result:
            i.status === "completed" && a && ans && i.quiz_attempt_id
              ? {
                  attempt_id: i.quiz_attempt_id,
                  is_correct: a.is_correct,
                  selected_option_id: a.selected_option_id,
                  correct_option_id: ans.correct_option_id,
                  correct_answer: ans.correct_answer,
                  explanation: ans.explanation,
                }
              : null,
        },
      ];
    });

    return ok({ ...toReviewInfo(review, items), items: list });
  });
}
