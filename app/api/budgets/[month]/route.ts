import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, noContent, ok, readJson, requireUser } from "@/lib/api/http";
import { MONTHLY_BUDGET_COLUMNS, parseMonth } from "@/lib/budget";
import { parseAmount } from "@/lib/ledger";

/**
 * PUT /api/budgets/{YYYY-MM} — 월 전체 예산 저장 {"amount":1000000}
 * 기존 있으면 수정 200, 없으면 생성 201 (PRD 8.9)
 * upsert는 user_id·budget_month UPDATE 권한이 필요하므로 '수정 → 없으면 생성' 순서로 처리한다.
 */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/budgets/[month]">) {
  return handle(async () => {
    const { first } = parseMonth((await ctx.params).month, { required: true });
    const { supabase } = await requireUser();
    const amount = parseAmount((await readJson(request)).amount);

    const update = () =>
      supabase.from("monthly_budgets").update({ amount }).eq("budget_month", first).select(MONTHLY_BUDGET_COLUMNS).maybeSingle();

    const updated = await update();
    if (updated.error) throw dbError(updated.error);
    if (updated.data) return ok(updated.data, 200);

    const created = await supabase
      .from("monthly_budgets")
      .insert({ budget_month: first, amount })
      .select(MONTHLY_BUDGET_COLUMNS)
      .single();
    if (created.error) {
      // 동시에 다른 요청이 먼저 만들었으면 수정으로 처리
      if (created.error.code === "23505") {
        const retry = await update();
        if (retry.error) throw dbError(retry.error);
        if (retry.data) return ok(retry.data, 200);
      }
      throw dbError(created.error);
    }
    return ok(created.data, 201);
  });
}

/** DELETE /api/budgets/{YYYY-MM} — 전체 예산 삭제. 분류별 예산만 함께 삭제되고 거래·분류는 보존 (PRD 4.4) */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/budgets/[month]">) {
  return handle(async () => {
    const { first } = parseMonth((await ctx.params).month, { required: true });
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("monthly_budgets").delete().eq("budget_month", first).select("id");
    if (error) throw dbError(error);
    if (!data || data.length === 0) throw new ApiError(404, "NOT_FOUND", "이 달의 전체 예산이 없습니다.");
    return noContent();
  });
}
