import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, noContent, ok, readJson, requireUser } from "@/lib/api/http";
import { parseCategoryName } from "@/lib/entries";
import { requireUuid } from "@/lib/validate";

const notFound = () => new ApiError(404, "NOT_FOUND", "분류를 찾을 수 없습니다.");

/** PATCH /api/entry-categories/{id} — 이름 변경 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/entry-categories/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const name = parseCategoryName((await readJson(request)).name);
    const { data, error } = await supabase
      .from("entry_categories")
      .update({ name })
      .eq("id", id)
      .select("id, name, created_at")
      .maybeSingle();
    if (error) throw dbError(error, { duplicateMessage: "같은 이름의 분류가 이미 있습니다." });
    if (!data) throw notFound();
    return ok(data);
  });
}

/** DELETE /api/entry-categories/{id} — 기록이 사용 중이면 409 (DB FK가 최종 차단) */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/entry-categories/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("entry_categories").delete().eq("id", id).select("id");
    if (error) {
      throw dbError(error, { fkStatus: 409, fkMessage: "이 분류를 사용하는 기록이 있어 삭제할 수 없습니다." });
    }
    if (!data || data.length === 0) throw notFound();
    return noContent();
  });
}
