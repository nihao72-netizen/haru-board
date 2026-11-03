import type { NextRequest } from "next/server";
import { dbError, handle, ok, requireUser } from "@/lib/api/http";
import { CATEGORY_BUDGET_COLUMNS, findMonthlyBudget, parseMonth } from "@/lib/budget";

/**
 * GET /api/budgets?month=YYYY-MM (기본: 서울 기준 이번 달) — PRD 8.9
 * 응답: { month, budget: 전체 예산 | null, categories: 분류별 예산[] }
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const { month, first } = parseMonth(request.nextUrl.searchParams.get("month"));
    const budget = await findMonthlyBudget(supabase, first);
    if (!budget) return ok({ month, budget: null, categories: [] });

    const { data, error } = await supabase
      .from("category_budgets")
      .select(CATEGORY_BUDGET_COLUMNS)
      .eq("monthly_budget_id", budget.id)
      .order("created_at", { ascending: true });
    if (error) throw dbError(error);
    return ok({ month, budget, categories: data ?? [] });
  });
}
