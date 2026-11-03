import { dbError, handle, ok, requireUser } from "@/lib/api/http";
import { toReviewInfo, type ReviewStatus } from "@/lib/quiz";

/** GET /api/hanja/reviews — 내 주간 복습 회차 목록 (최근 주 먼저). 조회만, 회차를 만들지 않음 (PRD 8.11) */
export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("weekly_reviews")
      .select("id, review_week, status, weekly_review_items(status)")
      .order("review_week", { ascending: false });
    if (error) throw dbError(error);
    const rows = (data ?? []) as { id: string; review_week: string; status: ReviewStatus; weekly_review_items: { status: string }[] }[];
    return ok(rows.map((r) => toReviewInfo(r, r.weekly_review_items ?? [])));
  });
}
