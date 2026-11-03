import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, ok, requireUser } from "@/lib/api/http";
import { periodRange, todayKST } from "@/lib/date";
import { parsePeriod, type TxSummary } from "@/lib/ledger";
import { isDateString } from "@/lib/validate";

const PAGE = 1000; // Supabase 기본 최대 응답 행 수

/**
 * GET /api/transactions/summary?period=month&date=2026-11-03
 * 기간 전체 수입·지출·차액. 목록의 유형/분류/검색 필터와 독립 (PRD 4.3).
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const params = request.nextUrl.searchParams;
    const period = parsePeriod(params.get("period"));
    const date = params.get("date") ?? todayKST();
    if (!isDateString(date)) throw new ApiError(400, "VALIDATION_ERROR", "date는 YYYY-MM-DD 형식이어야 합니다.");
    const { start, end } = periodRange(period, date);

    let income = 0;
    let expense = 0;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount")
        .gte("transaction_date", start)
        .lte("transaction_date", end)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw dbError(error);
      for (const row of data ?? []) {
        if (row.type === "income") income += Number(row.amount);
        else expense += Number(row.amount);
      }
      if (!data || data.length < PAGE) break;
    }

    const summary: TxSummary = {
      total_income: income,
      total_expense: expense,
      balance: income - expense,
      start_date: start,
      end_date: end,
    };
    return ok(summary);
  });
}
