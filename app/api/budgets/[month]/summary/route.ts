import type { NextRequest } from "next/server";
import { dbError, handle, ok, requireUser } from "@/lib/api/http";
import {
  budgetLine,
  fetchExpenseCategories,
  fetchTransactionsInRange,
  findMonthlyBudget,
  parseMonth,
  type BudgetSummary,
} from "@/lib/budget";

/**
 * GET /api/budgets/{YYYY-MM}/summary — PRD 8.9
 * overall: 전체 예산 대비 그 달 전체 지출 (분류 예산이 없는 지출 포함)
 * categories: 모든 지출 분류별 예산·지출. 전체 예산과 분류 예산은 더하지 않는다 (PRD 4.4)
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/budgets/[month]/summary">) {
  return handle(async () => {
    const { month, first, start, end } = parseMonth((await ctx.params).month, { required: true });
    const { supabase } = await requireUser();

    const [monthly, categories, expenses] = await Promise.all([
      findMonthlyBudget(supabase, first),
      fetchExpenseCategories(supabase),
      fetchTransactionsInRange(supabase, start, end, "expense"),
    ]);

    const categoryBudgets = new Map<string, number>();
    if (monthly) {
      const { data, error } = await supabase
        .from("category_budgets")
        .select("category_id, amount")
        .eq("monthly_budget_id", monthly.id);
      if (error) throw dbError(error);
      for (const row of data ?? []) categoryBudgets.set(row.category_id, Number(row.amount));
    }

    let totalSpent = 0;
    const spentByCategory = new Map<string, number>();
    for (const tx of expenses) {
      totalSpent += tx.amount;
      spentByCategory.set(tx.category_id, (spentByCategory.get(tx.category_id) ?? 0) + tx.amount);
    }

    const summary: BudgetSummary = {
      month,
      start_date: start,
      end_date: end,
      overall: budgetLine(monthly ? Number(monthly.amount) : null, totalSpent),
      categories: categories
        .map((c) => ({
          category_id: c.id,
          name: c.name,
          ...budgetLine(categoryBudgets.get(c.id) ?? null, spentByCategory.get(c.id) ?? 0),
        }))
        // 지출 많은 순, 같으면 이름순 (fetchExpenseCategories가 이름순이므로 안정 정렬 유지)
        .sort((a, b) => b.spent - a.spent),
    };
    return ok(summary);
  });
}
