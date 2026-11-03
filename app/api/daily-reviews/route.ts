import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, noContent, ok, readJson, requireUser } from "@/lib/api/http";
import { DAILY_REVIEW_COLUMNS, parseDateParam, parseDiaryPut } from "@/lib/daily";
import { todayKST } from "@/lib/date";

/** GET /api/daily-reviews?date=YYYY-MM-DD (기본 오늘) — 그날 일기, 없으면 data: null (PRD 8.12) */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const date = parseDateParam(request.nextUrl.searchParams.get("date"), todayKST());
    const { data, error } = await supabase.from("daily_reviews").select(DAILY_REVIEW_COLUMNS).eq("review_date", date).maybeSingle();
    if (error) throw dbError(error);
    return ok(data);
  });
}

/**
 * PUT /api/daily-reviews — {"review_date":"2026-11-03","content":"..."} 저장(UPSERT). 생성 201, 수정 200.
 * DB는 content 컬럼만 UPDATE 권한을 주므로 PostgREST upsert 대신 '수정 → 없으면 생성' 순서로 처리한다.
 */
export async function PUT(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const input = parseDiaryPut(await readJson(request));

    const update = () =>
      supabase
        .from("daily_reviews")
        .update({ content: input.content })
        .eq("review_date", input.review_date)
        .select(DAILY_REVIEW_COLUMNS)
        .maybeSingle();

    const updated = await update();
    if (updated.error) throw dbError(updated.error);
    if (updated.data) return ok(updated.data, 200);

    const created = await supabase.from("daily_reviews").insert(input).select(DAILY_REVIEW_COLUMNS).single();
    if (created.error) {
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

/** DELETE /api/daily-reviews?date=YYYY-MM-DD — 일기만 삭제 (생활 기록은 그대로) */
export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const raw = request.nextUrl.searchParams.get("date");
    if (!raw) throw new ApiError(400, "VALIDATION_ERROR", "삭제할 날짜(date)가 필요합니다.");
    const date = parseDateParam(raw, raw);
    const { data, error } = await supabase.from("daily_reviews").delete().eq("review_date", date).select("id");
    if (error) throw dbError(error);
    if (!data || data.length === 0) throw new ApiError(404, "NOT_FOUND", "그날 작성한 일기가 없습니다.");
    return noContent();
  });
}
