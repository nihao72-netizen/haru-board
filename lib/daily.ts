import { ApiError } from "@/lib/api/http";
import type { BudgetLine } from "@/lib/budget";
import type { Entry, EntryCategory } from "@/lib/entries";
import type { LearningRecord } from "@/lib/hanja";
import type { Transaction } from "@/lib/ledger";
import type { AttemptRecord } from "@/lib/quiz";
import { isDateString, optionalText, requireDate, requireText } from "@/lib/validate";
import { DAILY_REVIEW_COLUMNS, DIARY_MAX, DIARY_TITLE_MAX, type DailyReview } from "@/lib/diary";

export { DAILY_REVIEW_COLUMNS, DIARY_MAX, DIARY_TITLE_MAX };
export type { DailyReview, DiaryWithContent } from "@/lib/diary";

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
    /**
     * 홈 세 칸 (각 최대 HOME_PREVIEW개, 하위 작업 제외)
     * - done: 한 일 — 최근에 완료한 순 (updated_at 내림차순)
     * - today: 오늘 할 일 — 오늘 미완료, 시각·우선순위 순
     * - pending: 해야 될 일 — 오늘이 아닌 미완료(기한 지남 + 내일 이후), 오늘에 가까운 날짜부터
     */
    home: {
      done: NamedEntry[];
      today: NamedEntry[];
      pending: NamedEntry[];
      counts: { done_today: number; today: number; overdue: number; later: number };
    };
  };
  categories: EntryCategory[];
  finance: { today_income: number; today_expense: number; month: string; month_expense: number; budget: BudgetLine };
  hanja: { today: LearningRecord | null; open_review_count: number };
  diary: { written: boolean };
};

export const HOME_PREVIEW = 5;

/** 해야 될 일: 기한 지남(최근 날짜부터)과 내일 이후(가까운 날짜부터)를 오늘과의 거리순으로 합친다. 같은 거리면 기한 지남 먼저 */
export function mergeByDistance<T extends { record_date: string }>(overdue: T[], later: T[], today: string, limit: number): T[] {
  const dist = (d: string) => Math.abs(Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`));
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (out.length < limit && (i < overdue.length || j < later.length)) {
    if (j >= later.length || (i < overdue.length && dist(overdue[i].record_date) <= dist(later[j].record_date))) out.push(overdue[i++]);
    else out.push(later[j++]);
  }
  return out;
}

/** 쿼리의 date (없으면 기본값). 형식 오류는 400 */
export function parseDateParam(v: string | null, fallback: string): string {
  const date = v ?? fallback;
  if (!isDateString(date)) throw new ApiError(400, "VALIDATION_ERROR", "date는 YYYY-MM-DD 형식이어야 합니다.");
  return date;
}

/** title: 없으면(undefined) 기존 제목 유지, null·빈 문자열이면 제목 없음 */
export function parseDiaryPut(body: Record<string, unknown>) {
  return {
    review_date: requireDate(body.review_date, "일기 날짜"),
    content: requireText(body.content, "일기 내용", DIARY_MAX),
    ...(body.title === undefined ? {} : { title: optionalText(body.title, "일기 제목", DIARY_TITLE_MAX) }),
  };
}

/** category_id → 이름을 붙인다 */
export function withCategoryName<T extends { category_id: string }>(rows: T[], names: Map<string, string>) {
  return rows.map((r) => ({ ...r, category_name: names.get(r.category_id) ?? null }));
}
