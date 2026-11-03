import { ApiError } from "@/lib/api/http";
import type { BudgetLine } from "@/lib/budget";
import type { Entry, EntryCategory } from "@/lib/entries";
import type { LearningRecord } from "@/lib/hanja";
import type { Transaction } from "@/lib/ledger";
import type { AttemptRecord } from "@/lib/quiz";
import { isDateString, requireDate, requireText } from "@/lib/validate";

export type DailyReview = { id: string; review_date: string; content: string; created_at: string; updated_at: string };

export const DAILY_REVIEW_COLUMNS = "id, review_date, content, created_at, updated_at";

/** 일기 본문 최대 길이 */
export const DIARY_MAX = 10_000;

export type NamedEntry = Entry & { category_name: string | null };
export type NamedTransaction = Transaction & { category_name: string | null };

/** GET /api/daily-summary 응답 (PRD 4.8) */
export type DailySummary = {
  date: string;
  todos: { items: NamedEntry[]; total: number; completed: number; incomplete: number };
  memos: { items: NamedEntry[]; total: number };
  finance: { items: NamedTransaction[]; total_income: number; total_expense: number; balance: number; truncated: boolean };
  hanja: {
    learning: LearningRecord | null;
    daily_attempts: AttemptRecord[];
    review_attempts: AttemptRecord[];
  };
  diary: DailyReview | null;
};

/** GET /api/dashboard 응답 (PRD 4.9) */
export type Dashboard = {
  date: string;
  todos: {
    /** 강조 목록: 오늘 미완료 + 이전 날짜 미완료 */
    focus: NamedEntry[];
    /** 접기 목록: 오늘 날짜의 완료 */
    completed_today: NamedEntry[];
    counts: { today_total: number; today_completed: number; today_incomplete: number; previous_incomplete: number };
  };
  categories: EntryCategory[];
  finance: { today_income: number; today_expense: number; month: string; month_expense: number; budget: BudgetLine };
  hanja: { today: LearningRecord | null; open_review_count: number };
  diary: { written: boolean };
};

/** 쿼리의 date (없으면 기본값). 형식 오류는 400 */
export function parseDateParam(v: string | null, fallback: string): string {
  const date = v ?? fallback;
  if (!isDateString(date)) throw new ApiError(400, "VALIDATION_ERROR", "date는 YYYY-MM-DD 형식이어야 합니다.");
  return date;
}

export function parseDiaryPut(body: Record<string, unknown>) {
  return {
    review_date: requireDate(body.review_date, "일기 날짜"),
    content: requireText(body.content, "일기 내용", DIARY_MAX),
  };
}

/** category_id → 이름을 붙인다 */
export function withCategoryName<T extends { category_id: string }>(rows: T[], names: Map<string, string>) {
  return rows.map((r) => ({ ...r, category_name: names.get(r.category_id) ?? null }));
}
