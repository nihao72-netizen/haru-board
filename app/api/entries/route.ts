import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, ok, pagination, readJson, requireUser } from "@/lib/api/http";
import { todayKST } from "@/lib/date";
import { ENTRY_COLUMNS, parseEntryCreate } from "@/lib/entries";
import { ilikeValue, isDateString, isUuid } from "@/lib/validate";

/**
 * GET /api/entries — 목록 (PRD 8.3)
 * 필터: type=todo|memo, category_id, status=completed|incomplete, date=YYYY-MM-DD,
 *       due=overdue|today|upcoming|none, search, page, limit(최대 100)
 * 정렬: record_date 내림차순 → created_at 내림차순 → id (안정 정렬)
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const params = request.nextUrl.searchParams;
    const { page, limit, from, to } = pagination(params);

    let query = supabase.from("entries").select(ENTRY_COLUMNS, { count: "exact" });

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

    const { data, error, count } = await query
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      // 범위를 벗어난 페이지는 빈 목록으로 응답
      if (error.code === "PGRST103") return ok({ items: [], page, limit, total: count ?? 0 });
      throw dbError(error);
    }
    return ok({ items: data ?? [], page, limit, total: count ?? 0 });
  });
}

/** POST /api/entries — 등록. user_id는 DB 기본값(auth.uid())으로 결정 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const input = parseEntryCreate(await readJson(request));

    const { data, error } = await supabase.from("entries").insert(input).select(ENTRY_COLUMNS).single();
    if (error) throw dbError(error, { fkMessage: "선택한 분류를 사용할 수 없습니다." });
    return ok(data, 201);
  });
}
