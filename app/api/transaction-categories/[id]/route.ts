import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, noContent, ok, readJson, requireUser } from "@/lib/api/http";
import { requireText, requireUuid } from "@/lib/validate";

const notFound = () => new ApiError(404, "NOT_FOUND", "분류를 찾을 수 없습니다.");

/** PATCH /api/transaction-categories/{id} — 이름만 변경 (유형은 변경 불가) */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/transaction-categories/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const body = await readJson(request);
    if ("type" in body) throw new ApiError(400, "VALIDATION_ERROR", "분류 유형은 변경할 수 없습니다.");
    const name = requireText(body.name, "분류 이름", 50);
    const { data, error } = await supabase
      .from("transaction_categories")
      .update({ name })
      .eq("id", id)
      .select("id, type, name, created_at")
      .maybeSingle();
    if (error) throw dbError(error, { duplicateMessage: "같은 유형에 같은 이름의 분류가 이미 있습니다." });
    if (!data) throw notFound();
    return ok(data);
  });
}

/** DELETE /api/transaction-categories/{id} — 거래·분류 예산이 사용 중이면 409 (PRD 8.8) */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/transaction-categories/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("transaction_categories").delete().eq("id", id).select("id");
    if (error) {
      throw dbError(error, { fkStatus: 409, fkMessage: "이 분류를 사용하는 거래나 예산이 있어 삭제할 수 없습니다." });
    }
    if (!data || data.length === 0) throw notFound();
    return noContent();
  });
}
