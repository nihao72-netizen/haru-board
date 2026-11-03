import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, dbError } from "@/lib/api/http";
import { isMonthString, monthRange, todayKST } from "@/lib/date";

/** PRD 4.4 예산 상태 */
export type BudgetStatus = "normal" | "warning" | "limit_reached" | "exceeded" | "not_set";

export type BudgetLine = {
  budget: number | null;
  spent: number;
  remaining: number | null;
  usage_rate: number | null;
  status: BudgetStatus;
};

export type MonthlyBudget = { id: string; budget_month: string; amount: number; created_at: string; updated_at: string };
export type CategoryBudget = {
  id: string;
  monthly_budget_id: string;
  category_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
};

export type BudgetSummary = {
  month: string;
  start_date: string;
  end_date: string;
  overall: BudgetLine;
  categories: (BudgetLine & { category_id: string; name: string })[];
};

export type MonthlyStats = {
  month: string;
  months: { month: string; total_income: number; total_expense: number }[];
  comparison: {
    current_expense: number;
    previous_expense: number;
    /** 전월 지출이 0이면 비교 불가 → null */
    change_amount: number | null;
    change_rate: number | null;
  };
  categories: { category_id: string; name: string; amount: number; ratio: number }[];
};

export const MONTHLY_BUDGET_COLUMNS = "id, budget_month, amount, created_at, updated_at";
export const CATEGORY_BUDGET_COLUMNS = "id, monthly_budget_id, category_id, amount, created_at, updated_at";

const PAGE = 1000; // Supabase 기본 최대 응답 행 수

/** 경로·쿼리의 월(YYYY-MM). 없으면 서울 기준 이번 달 */
export function parseMonth(v: string | null | undefined, { required = false } = {}) {
  const month = v ?? (required ? null : todayKST().slice(0, 7));
  if (!isMonthString(month)) throw new ApiError(400, "VALIDATION_ERROR", "월은 YYYY-MM 형식이어야 합니다.");
  const { start, end } = monthRange(month);
  return { month, first: start, start, end };
}

/**
 * 사용률과 상태. 판정은 반올림 전 정수 금액으로 (PRD 4.4)
 * normal <80%, warning 80% 이상~100% 미만, limit_reached 정확히 100%, exceeded >100%
 */
export function budgetLine(budget: number | null, spent: number): BudgetLine {
  if (budget === null) return { budget: null, spent, remaining: null, usage_rate: null, status: "not_set" };
  const b = BigInt(budget);
  const s = BigInt(spent);
  const status: BudgetStatus =
    s > b ? "exceeded" : s === b ? "limit_reached" : s * BigInt(5) >= b * BigInt(4) ? "warning" : "normal";
  return {
    budget,
    spent,
    remaining: budget - spent,
    usage_rate: Math.round((spent / budget) * 1000) / 10, // 표시용: 소수 첫째 자리
    status,
  };
}

/** 기간 안의 거래를 페이지 단위로 모두 읽는다 (RLS로 본인 것만) */
export async function fetchTransactionsInRange(supabase: SupabaseClient, start: string, end: string, type?: "expense") {
  const rows: { type: string; amount: number; category_id: string; transaction_date: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("transactions")
      .select("type, amount, category_id, transaction_date")
      .gte("transaction_date", start)
      .lte("transaction_date", end);
    if (type) q = q.eq("type", type);
    const { data, error } = await q.order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw dbError(error);
    for (const r of data ?? []) rows.push({ ...r, amount: Number(r.amount) });
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** 해당 월의 전체 예산 행 (없으면 null) */
export async function findMonthlyBudget(supabase: SupabaseClient, first: string) {
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select(MONTHLY_BUDGET_COLUMNS)
    .eq("budget_month", first)
    .maybeSingle();
  if (error) throw dbError(error);
  return data as MonthlyBudget | null;
}

/** 지출 분류 목록 (이름순) */
export async function fetchExpenseCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("transaction_categories")
    .select("id, name")
    .eq("type", "expense")
    .order("name", { ascending: true });
  if (error) throw dbError(error);
  return (data ?? []) as { id: string; name: string }[];
}
