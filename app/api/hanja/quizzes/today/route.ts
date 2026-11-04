import { dbError, handle, ok, requireUser } from "@/lib/api/http";
import { addDays, todayKST } from "@/lib/date";
import { findLearning } from "@/lib/hanja";
import { QUESTION_COLUMNS, toQuizQuestion, type QuestionRow, type TodayQuiz } from "@/lib/quiz";

/**
 * GET /api/hanja/quizzes/today — 오늘 배정된 한자의 문제 (정답·해설 제외). PRD 8.10
 * 오늘 배정이 없으면 data: null. 한자당 정확히 1문제.
 */
export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const today = todayKST();
    const learning = await findLearning(supabase, "learning_date", today);
    if (!learning) return ok(null);

    const q = await supabase
      .from("quiz_questions")
      .select(QUESTION_COLUMNS)
      .eq("character_id", learning.character.id)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (q.error) throw dbError(q.error);
    if (!q.data) return ok(null);
    const question = q.data as QuestionRow;

    // 오늘(서울) 이 문제를 푼 횟수
    const attempts = await supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("question_id", question.id)
      .eq("attempt_type", "daily")
      .gte("attempted_at", `${today}T00:00:00+09:00`)
      .lt("attempted_at", `${addDays(today, 1)}T00:00:00+09:00`);
    if (attempts.error) throw dbError(attempts.error);

    const quiz: TodayQuiz = {
      ...toQuizQuestion(question),
      learning_id: learning.learning_id,
      character: learning.character,
      attempt_count: attempts.count ?? 0,
    };
    return ok(quiz);
  });
}
