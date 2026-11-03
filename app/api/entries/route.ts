import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, ok, pagination, readJson, requireUser } from "@/lib/api/http";
import { todayKST } from "@/lib/date";
import { attachSubtaskCounts, checkParent, ENTRY_COLUMNS, parseEntryCreate, type Entry } from "@/lib/entries";
import { ilikeValue, isDateString, isUuid } from "@/lib/validate";

/**
 * GET /api/entries — 목록 (PRD 8.3)
 * 필터: type=todo|memo, category_id, status=completed|incomplete, date=YYYY-MM-DD,
 *       due=overdue|today|upcoming|none, search, page, limit(최대 100)
 * 할 일 화면 확장:
 *   from, to          : record_date 범위(양 끝 포함). 범위 조회는 limit 최대 500
 *   parent_id=<uuid>  : 그 할 일의 하위 작업만 / top_level=true : 하위 작업 제외
 *   remind_from, remind_to : 알림 시각 범위 (ISO, 시간대 포함)
 *   sort=schedule     : 날짜 → 시각 → 우선순위 → 등록 순 (오름차순)
 *   with_subtasks=true: 항목마다 subtask_total, subtask_completed 포함
 * 기본 정렬: record_date 내림차순 → created_at 내림차순 → id (안정 정렬)
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const params = request.nextUrl.searchParams;
    const ranged = params.has("from") || params.has("to") || params.has("parent_id") || params.has("remind_from");
    const { page, limit, from, to } = pagination(params, ranged ? 500 : 100);

    let query = supabase.from("entries").select(ENTRY_COLUMNS, { count: "exact" });

    for (const [key, op] of [["from", "gte"], ["to", "lte"]] as const) {
      const v = params.get(key);
      if (!v) continue;
      if (!isDateString(v)) throw new ApiError(400, "VALIDATION_ERROR", `${key}는 YYYY-MM-DD 형식이어야 합니다.`);
      query = op === "gte" ? query.gte("record_date", v) : query.lte("record_date", v);
    }

    const parentId = params.get("parent_id");
    if (parentId) {
      if (!isUuid(parentId)) throw new ApiError(400, "VALIDATION_ERROR", "parent_id가 올바르지 않습니다.");
      query = query.eq("parent_id", parentId);
    } else if (params.get("top_level") === "true") {
      query = query.is("parent_id", null);
    }

    for (const [key, op] of [["remind_from", "gte"], ["remind_to", "lt"]] as const) {
      const v = params.get(key);
      if (!v) continue;
      if (Number.isNaN(Date.parse(v))) throw new ApiError(400, "VALIDATION_ERROR", `${key}는 ISO 시각이어야 합니다.`);
      const iso = new Date(v).toISOString();
      query = op === "gte" ? query.gte("remind_at", iso) : query.lt("remind_at", iso);
    }

    const type = params.get("type");
    if (type) {
      if (type !== "todo" && type !== "memo") throw new ApiError(400, "VALIDATION_ERROR", "type은 todo 또는 memo여야 합니다.");
      query = query.eq("type", type);
    }

    const categoryId = params.get("category_id");
    if (categoryId) {
      if (!isUuid(categoryId)) throw new ApiError(400, "VALIDATION_ERROR", "category_id가 올바르지 않습니다.");
      query = query.eq("category_id", categoryId);
    }

    const status = params.get("status");
    if (status) {
      if (status === "completed") query = query.eq("type", "todo").eq("is_completed", true);
      else if (status === "incomplete") query = query.eq("type", "todo").eq("is_completed", false);
      else throw new ApiError(400, "VALIDATION_ERROR", "status는 completed 또는 incomplete여야 합니다.");
    }

    const date = params.get("date");
    if (date) {
      if (!isDateString(date)) throw new ApiError(400, "VALIDATION_ERROR", "date는 YYYY-MM-DD 형식이어야 합니다.");
      query = query.eq("record_date", date);
    }

    const due = params.get("due");
    if (due) {
      const today = todayKST();
      if (due === "overdue") query = query.lt("due_date", today).eq("type", "todo").eq("is_completed", false);
      else if (due === "today") query = query.eq("due_date", today);
      else if (due === "upcoming") query = query.gt("due_date", today);
      else if (due === "none") query = query.is("due_date", null);
      else throw new ApiError(400, "VALIDATION_ERROR", "due는 overdue, today, upcoming, none 중 하나여야 합니다.");
    }

    const search = params.get("search")?.trim();
    if (search) {
      if (search.length > 100) throw new ApiError(400, "VALIDATION_ERROR", "검색어는 100자 이하로 입력해 주세요.");
      const v = ilikeValue(search);
      query = query.or(`title.ilike.${v},content.ilike.${v}`);
    }

    const sort = params.get("sort");
    if (sort && sort !== "schedule") throw new ApiError(400, "VALIDATION_ERROR", "sort는 schedule만 지원합니다.");
    query =
      sort === "schedule"
        ? query
            .order("record_date", { ascending: true })
            .order("scheduled_time", { ascending: true, nullsFirst: false })
            .order("priority", { ascending: true })
            .order("created_at", { ascending: true })
        : query.order("record_date", { ascending: false }).order("created_at", { ascending: false });

    const { data, error, count } = await query.order("id", { ascending: true }).range(from, to);

    if (error) {
      // 범위를 벗어난 페이지는 빈 목록으로 응답
      if (error.code === "PGRST103") return ok({ items: [], page, limit, total: count ?? 0 });
      throw dbError(error);
    }
    const items = (data ?? []) as Entry[];
    const withCounts = params.get("with_subtasks") === "true" ? await attachSubtaskCounts(supabase, items) : items;
    return ok({ items: withCounts, page, limit, total: count ?? 0 });
  });
}

/** POST /api/entries — 등록. user_id는 DB 기본값(auth.uid())으로 결정 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const input = parseEntryCreate(await readJson(request));
    if (input.parent_id) await checkParent(supabase, input.parent_id);

    const { data, error } = await supabase.from("entries").insert(input).select(ENTRY_COLUMNS).single();
    if (error) throw dbError(error, { fkMessage: "선택한 분류를 사용할 수 없습니다." });
    return ok(data, 201);
  });
}
