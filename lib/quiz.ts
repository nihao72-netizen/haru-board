import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ApiError, dbError } from "@/lib/api/http";
import { addDays } from "@/lib/date";
import type { HanjaBrief } from "@/lib/hanja";
import { requireUuid } from "@/lib/validate";

export type OptionId = "A" | "B" | "C" | "D";
export type QuizOption = { id: OptionId; text: string };
export type QuestionType = "reading" | "meaning";

/** 정답·해설이 없는 문제 (클라이언트 제공용) */
export type QuizQuestion = {
  question_id: string;
  question_type: QuestionType;
  question: string;
  options: QuizOption[];
};

export type TodayQuiz = QuizQuestion & {
  learning_id: string;
  character: HanjaBrief;
  /** 오늘 이 문제를 푼 횟수. 정답이 드러나지 않도록 선택·정오는 포함하지 않음 (풀이 기록 API에서 조회) */
  attempt_count: number;
};

/** 채점 결과 (PRD 8.10 제출 후 응답) */
export type GradeResult = {
  attempt_id: string;
  question_id: string;
  is_correct: boolean;
  selected_option_id: OptionId;
  correct_option_id: OptionId;
  correct_answer: string;
  explanation: string | null;
  is_duplicate: boolean;
};

export type AttemptRecord = {
  attempt_id: string;
  attempt_type: "daily" | "review";
  attempted_at: string;
  question_id: string;
  question: string;
  question_type: QuestionType;
  character: HanjaBrief | null;
  selected_option_id: OptionId;
  selected_answer: string | null;
  is_correct: boolean;
  correct_option_id: OptionId | null;
  correct_answer: string | null;
  explanation: string | null;
};

export type ReviewStatus = "pending" | "in_progress" | "completed";

export type ReviewInfo = {
  review_id: string;
  review_week: string;
  source_start_date: string;
  source_end_date: string;
  total_questions: number;
  completed_questions: number;
  status: ReviewStatus;
};

export type ReviewItem = QuizQuestion & {
  item_id: string;
  status: "pending" | "completed";
  character: HanjaBrief | null;
  /** 완료 항목에만 채점 결과 */
  result: Omit<GradeResult, "is_duplicate" | "question_id"> | null;
};

export type ReviewSummary = {
  review_id: string;
  review_week: string;
  status: ReviewStatus;
  total_questions: number;
  completed_questions: number;
  correct_count: number;
  incorrect_count: number;
  /** 완료한 문제가 없으면 null */
  accuracy_rate: number | null;
};

export const QUESTION_COLUMNS = "id, character_id, question_type, question_text, options"; // 정답·해설 컬럼은 권한 없음

export type QuestionRow = {
  id: string;
  character_id: string;
  question_type: QuestionType;
  question_text: string;
  options: QuizOption[];
};

export function toQuizQuestion(q: QuestionRow): QuizQuestion {
  return { question_id: q.id, question_type: q.question_type, question: q.question_text, options: q.options };
}

export function parseOptionId(v: unknown): OptionId {
  if (v !== "A" && v !== "B" && v !== "C" && v !== "D") {
    throw new ApiError(400, "VALIDATION_ERROR", "selected_option_id는 A, B, C, D 중 하나여야 합니다.");
  }
  return v;
}

export function parseDailySubmit(body: Record<string, unknown>) {
  return {
    question_id: requireUuid(body.question_id, "question_id"),
    selected_option_id: parseOptionId(body.selected_option_id),
    request_id: requireUuid(body.request_id, "request_id"),
  };
}

/** 채점 함수(HB 오류 코드)의 영어 메시지를 사용자용 한국어로 바꾼다 */
const MESSAGES: Record<string, [number, string, string]> = {
  request_id_required: [400, "VALIDATION_ERROR", "request_id가 필요합니다."],
  invalid_answer: [400, "VALIDATION_ERROR", "보기를 하나 선택해 주세요."],
  question_not_available_today: [404, "NOT_FOUND", "오늘 배정된 한자의 문제만 풀 수 있습니다."],
  request_id_conflict: [409, "REQUEST_ID_CONFLICT", "같은 요청 번호로 다른 답이 이미 제출되었습니다. 새로 풀어 주세요."],
  review_not_found: [404, "NOT_FOUND", "복습 회차를 찾을 수 없습니다."],
  review_item_not_found: [404, "NOT_FOUND", "복습 문제를 찾을 수 없습니다."],
  review_item_already_answered: [409, "ALREADY_ANSWERED", "이미 다른 답으로 제출한 복습 문제입니다. 한 문제는 한 번만 제출할 수 있습니다."],
};

export function quizDbError(error: PostgrestError): ApiError {
  const m = MESSAGES[error.message];
  if (m && error.code?.startsWith("HB")) return new ApiError(m[0], m[1], m[2]);
  return dbError(error);
}

/** 문제 + 한자 요약을 한 번에 읽는다 (RLS: 배정된 한자의 문제만) */
export async function loadQuestions(supabase: SupabaseClient, ids: string[]) {
  const questions = new Map<string, QuestionRow>();
  const characters = new Map<string, HanjaBrief>();
  if (ids.length === 0) return { questions, characters };
  const { data, error } = await supabase.from("quiz_questions").select(QUESTION_COLUMNS).in("id", ids);
  if (error) throw dbError(error);
  for (const q of (data ?? []) as QuestionRow[]) questions.set(q.id, q);
  const charIds = [...new Set([...questions.values()].map((q) => q.character_id))];
  if (charIds.length) {
    const c = await supabase.from("hanja_characters").select("id, character, reading, meaning").in("id", charIds);
    if (c.error) throw dbError(c.error);
    for (const ch of (c.data ?? []) as HanjaBrief[]) characters.set(ch.id, ch);
  }
  return { questions, characters };
}

/** 내가 이미 푼 시도의 정답·해설 (DB 함수가 본인 시도만 반환) */
export async function loadAnswers(supabase: SupabaseClient, attemptIds: string[]) {
  const answers = new Map<string, { correct_option_id: OptionId; correct_answer: string; explanation: string | null }>();
  if (attemptIds.length === 0) return answers;
  const { data, error } = await supabase.rpc("get_my_attempt_answers", { p_attempt_ids: attemptIds });
  if (error) throw dbError(error);
  for (const r of (data ?? []) as { attempt_id: string; correct_option_id: OptionId; correct_answer: string; explanation: string | null }[]) {
    answers.set(r.attempt_id, { correct_option_id: r.correct_option_id, correct_answer: r.correct_answer, explanation: r.explanation });
  }
  return answers;
}

export function optionText(q: QuestionRow | undefined, id: string | null | undefined) {
  return q?.options.find((o) => o.id === id)?.text ?? null;
}

type ReviewRow = { id: string; review_week: string; status: ReviewStatus };

export type ReviewItemRow = {
  id: string;
  question_id: string;
  status: "pending" | "completed";
  quiz_attempt_id: string | null;
  completed_at: string | null;
};

/** 회차 + 항목 (RLS: 본인 회차만). 없으면 404 */
export async function loadReview(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("id, review_week, status, weekly_review_items(id, question_id, status, quiz_attempt_id, completed_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "복습 회차를 찾을 수 없습니다.");
  const row = data as ReviewRow & { weekly_review_items: ReviewItemRow[] };
  // 문항 순서 고정: 문제 id 순
  const items = [...(row.weekly_review_items ?? [])].sort((a, b) => a.question_id.localeCompare(b.question_id));
  return { review: row, items };
}

/** 완료 항목의 시도(선택·정오) */
export async function loadAttempts(supabase: SupabaseClient, ids: string[]) {
  const map = new Map<string, { selected_option_id: OptionId; is_correct: boolean }>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.from("quiz_attempts").select("id, selected_option_id, is_correct").in("id", ids);
  if (error) throw dbError(error);
  for (const a of (data ?? []) as { id: string; selected_option_id: OptionId; is_correct: boolean }[]) map.set(a.id, a);
  return map;
}

/** 회차 정보 + 문항 수 */
export function toReviewInfo(r: ReviewRow, items: { status: string }[]): ReviewInfo {
  return {
    review_id: r.id,
    review_week: r.review_week,
    source_start_date: addDays(r.review_week, -7),
    source_end_date: addDays(r.review_week, -1),
    total_questions: items.length,
    completed_questions: items.filter((i) => i.status === "completed").length,
    status: r.status,
  };
}
