import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, noContent, ok, readJson, requireUser } from "@/lib/api/http";
import { parseTxUpdate, TX_COLUMNS, TX_FK_MESSAGE } from "@/lib/ledger";
import { requireUuid } from "@/lib/validate";

const notFound = () => new ApiError(404, "NOT_FOUND", "거래를 찾을 수 없습니다.");

/** GET /api/transactions/{id} */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("transactions").select(TX_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw notFound();
    return ok(data);
  });
}

/** PATCH /api/transactions/{id} — 유형을 바꾸면 그 유형의 분류도 함께 보내야 함 (DB 복합 FK) */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const patch = parseTxUpdate(await readJson(request));
    const { data, error } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", id)
      .select(TX_COLUMNS)
      .maybeSingle();
    if (error) throw dbError(error, { fkMessage: TX_FK_MESSAGE });
    if (!data) throw notFound();
    return ok(data);
  });
}

/** DELETE /api/transactions/{id} — 204 */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("transactions").delete().eq("id", id).select("id");
    if (error) throw dbError(error);
    if (!data || data.length === 0) throw notFound();
    return noContent();
  });
}
