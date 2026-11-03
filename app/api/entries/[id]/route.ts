import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, noContent, ok, readJson, requireUser } from "@/lib/api/http";
import { checkParent, ENTRY_COLUMNS, parseEntryUpdate } from "@/lib/entries";
import { requireUuid } from "@/lib/validate";

const notFound = () => new ApiError(404, "NOT_FOUND", "기록을 찾을 수 없습니다.");

/** GET /api/entries/{id} — 상세 (다른 사용자 기록은 RLS로 보이지 않아 404) */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/entries/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("entries").select(ENTRY_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw notFound();
    return ok(data);
  });
}

/** PATCH /api/entries/{id} — 수정·완료 처리. 예: {"is_completed": true} */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/entries/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const patch = parseEntryUpdate(await readJson(request));
    if (typeof patch.parent_id === "string") await checkParent(supabase, patch.parent_id, id);
    if (patch.type === "memo") {
      // 메모로 바꾸려면 하위 작업이 아니고 하위 작업도 없어야 함
      const [{ data: cur }, { count }] = await Promise.all([
        supabase.from("entries").select("parent_id").eq("id", id).maybeSingle(),
        supabase.from("entries").select("id", { count: "exact", head: true }).eq("parent_id", id),
      ]);
      if ((cur?.parent_id && patch.parent_id !== null) || (count ?? 0) > 0) {
        throw new ApiError(400, "VALIDATION_ERROR", "하위 작업과 연결된 할 일은 메모로 바꿀 수 없습니다.");
      }
    }

    // 메모에 완료 처리 요청은 거부 (유형을 함께 todo로 바꾸는 경우는 허용)
    if (typeof patch.is_completed === "boolean" && patch.type !== "todo") {
      const { data: current, error } = await supabase.from("entries").select("type").eq("id", id).maybeSingle();
      if (error) throw dbError(error);
      if (!current) throw notFound();
      const nextType = (patch.type as string | undefined) ?? current.type;
      if (nextType === "memo") throw new ApiError(400, "VALIDATION_ERROR", "메모는 완료 처리할 수 없습니다.");
    }

    const { data, error } = await supabase
      .from("entries")
      .update(patch)
      .eq("id", id)
      .select(ENTRY_COLUMNS)
      .maybeSingle();
    if (error) throw dbError(error, { fkMessage: "선택한 분류를 사용할 수 없습니다." });
    if (!data) throw notFound();
    return ok(data);
  });
}

/** DELETE /api/entries/{id} — 삭제 (204). 하위 작업은 DB가 함께 삭제 */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/entries/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("entries").delete().eq("id", id).select("id");
    if (error) throw dbError(error);
    if (!data || data.length === 0) throw notFound();
    return noContent();
  });
}
