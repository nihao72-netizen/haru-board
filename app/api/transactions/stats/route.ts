import type { NextRequest } from "next/server";
import { ApiError, handle, ok, requireUser } from "@/lib/api/http";
import { fetchExpenseCategories, fetchTransactionsInRange, parseMonth, type MonthlyStats } from "@/lib/budget";
import { monthRange, shiftMonth } from "@/lib/date";

/**
 * GET /api/transactions/stats?month=YYYY-MM&months=6 — 가계부 통계·예산 탭 (PRD 4.3)
 * - months: 기준 월까지 최근 N개월(2~12, 기본 6)의 월별 수입·지출
 * - comparison: 기준 월과 전월 지출 비교. 전월 지출이 0이면 비교 불가(null)
 * - categories: 기준 월의 분류별 지출 (많은 순)
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const params = request.nextUrl.searchParams;
    const { month, start: monthStart } = parseMonth(params.get("month"));
    const count = Number(params.get("months") ?? "6");
    if (!Number.isInteger(count) || count < 2 || count > 12) {
      throw new ApiError(400, "VALIDATION_ERROR", "months는 2~12 사이의 정수여야 합니다.");
    }

    const firstMonth = shiftMonth(month, -(count - 1));
    const [rows, categories] = await Promise.all([
      fetchTransactionsInRange(supabase, monthRange(firstMonth).start, monthRange(month).end),
      fetchExpenseCategories(supabase),
    ]);

    const byMonth = new Map<string, { total_income: number; total_expense: number }>();
    for (let i = 0; i < count; i++) byMonth.set(shiftMonth(firstMonth, i), { total_income: 0, total_expense: 0 });
    const byCategory = new Map<string, number>();
    for (const r of rows) {
      const m = byMonth.get(r.transaction_date.slice(0, 7));
      if (!m) continue;
      if (r.type === "income") m.total_income += r.amount;
      else {
        m.total_expense += r.amount;
        if (r.transaction_date >= monthStart) byCategory.set(r.category_id, (byCategory.get(r.category_id) ?? 0) + r.amount);
      }
    }

    const current = byMonth.get(month)!.total_expense;
    const previous = byMonth.get(shiftMonth(month, -1))!.total_expense;
    const names = new Map(categories.map((c) => [c.id, c.name]));

    const stats: MonthlyStats = {
      month,
      months: [...byMonth.entries()].map(([m, v]) => ({ month: m, ...v })),
      comparison: {
        current_expense: current,
        previous_expense: previous,
        change_amount: previous === 0 ? null : current - previous,
        change_rate: previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10,
      },
      categories: [...byCategory.entries()]
        .map(([id, amount]) => ({
          category_id: id,
          name: names.get(id) ?? "(알 수 없는 분류)",
          amount,
          ratio: current === 0 ? 0 : Math.round((amount / current) * 1000) / 10,
        }))
        .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "ko")),
    };
    return ok(stats);
  });
}
