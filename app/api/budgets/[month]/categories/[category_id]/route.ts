import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, noContent, ok, readJson, requireUser } from "@/lib/api/http";
import { CATEGORY_BUDGET_COLUMNS, findMonthlyBudget, parseMonth } from "@/lib/budget";
import { parseAmount } from "@/lib/ledger";
import { requireUuid } from "@/lib/validate";

type Ctx = RouteContext<"/api/budgets/[month]/categories/[category_id]">;

const FK_MESSAGE = "지출 분류에만 예산을 설정할 수 있습니다. 분류가 없거나 수입 분류입니다.";

async function parseParams(ctx: Ctx) {
  const params = await ctx.params;
  const { first } = parseMonth(params.month, { required: true });
  return { first, categoryId: requireUuid(params.category_id, "category_id") };
}

/**
 * PUT /api/budgets/{YYYY-MM}/categories/{category_id} — 분류별 예산 저장 {"amount":300000}
 * 그 달의 전체 예산이 먼저 있어야 함(없으면 409). 기존 있으면 200, 없으면 201.
 * 지출 분류만 허용은 DB 복합 FK(category_type='expense')가 최종 보장.
 */
export async function PUT(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { first, categoryId } = await parseParams(ctx);
    const { supabase } = await requireUser();
    const amount = parseAmount((await readJson(request)).amount);

    const monthly = await findMonthlyBudget(supabase, first);
    if (!monthly) {
      throw new ApiError(409, "MONTHLY_BUDGET_REQUIRED", "분류별 예산을 정하려면 먼저 이 달의 전체 예산을 설정해 주세요.");
    }

    const update = () =>
      supabase
        .from("category_budgets")
        .update({ amount })
        .eq("monthly_budget_id", monthly.id)
        .eq("category_id", categoryId)
        .select(CATEGORY_BUDGET_COLUMNS)
        .maybeSingle();

    const updated = await update();
    if (updated.error) throw dbError(updated.error);
    if (updated.data) return ok(updated.data, 200);

    const created = await supabase
      .from("category_budgets")
      .insert({ monthly_budget_id: monthly.id, category_id: categoryId, amount })
      .select(CATEGORY_BUDGET_COLUMNS)
      .single();
    if (created.error) {
      if (created.error.code === "23505") {
        const retry = await update();
        if (retry.error) throw dbError(retry.error);
        if (retry.data) return ok(retry.data, 200);
      }
      throw dbError(created.error, { fkMessage: FK_MESSAGE });
    }
    return ok(created.data, 201);
  });
}

/** DELETE /api/budgets/{YYYY-MM}/categories/{category_id} — 분류별 예산만 삭제 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { first, categoryId } = await parseParams(ctx);
    const { supabase } = await requireUser();
    const monthly = await findMonthlyBudget(supabase, first);
    if (!monthly) throw new ApiError(404, "NOT_FOUND", "이 달의 분류별 예산이 없습니다.");
    const { data, error } = await supabase
      .from("category_budgets")
      .delete()
      .eq("monthly_budget_id", monthly.id)
      .eq("category_id", categoryId)
      .select("id");
    if (error) throw dbError(error);
    if (!data || data.length === 0) throw new ApiError(404, "NOT_FOUND", "이 달의 분류별 예산이 없습니다.");
    return noContent();
  });
}
