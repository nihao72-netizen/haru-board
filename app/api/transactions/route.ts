import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, ok, pagination, readJson, requireUser } from "@/lib/api/http";
import { periodRange, todayKST } from "@/lib/date";
import { parsePeriod, parseTxCreate, TX_COLUMNS, TX_FK_MESSAGE } from "@/lib/ledger";
import { ilikeValue, isDateString, isUuid } from "@/lib/validate";

/**
 * GET /api/transactions — 거래 목록 (PRD 8.8)
 * period=day|week|month (기본 month), date=YYYY-MM-DD (기본 서울 오늘),
 * type=all|income|expense, category_id, search(거래명·메모), page, limit(최대 100)
 * 정렬: 거래일 내림차순 → 등록 내림차순 → id
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const params = request.nextUrl.searchParams;
    const { page, limit, from, to } = pagination(params);

    const period = parsePeriod(params.get("period"));
    const date = params.get("date") ?? todayKST();
    if (!isDateString(date)) throw new ApiError(400, "VALIDATION_ERROR", "date는 YYYY-MM-DD 형식이어야 합니다.");
    const { start, end } = periodRange(period, date);

    let query = supabase
      .from("transactions")
      .select(TX_COLUMNS, { count: "exact" })
      .gte("transaction_date", start)
      .lte("transaction_date", end);

    const type = params.get("type") ?? "all";
    if (type === "income" || type === "expense") query = query.eq("type", type);
    else if (type !== "all") throw new ApiError(400, "VALIDATION_ERROR", "type은 all, income, expense 중 하나여야 합니다.");

    const categoryId = params.get("category_id");
    if (categoryId) {
      if (!isUuid(categoryId)) throw new ApiError(400, "VALIDATION_ERROR", "category_id가 올바르지 않습니다.");
      query = query.eq("category_id", categoryId);
    }

    const search = params.get("search")?.trim();
    if (search) {
      if (search.length > 100) throw new ApiError(400, "VALIDATION_ERROR", "검색어는 100자 이하로 입력해 주세요.");
      const v = ilikeValue(search);
      query = query.or(`name.ilike.${v},memo.ilike.${v}`);
    }

    const { data, error, count } = await query
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    const meta = { page, limit, total: count ?? 0, period, start_date: start, end_date: end };
    if (error) {
      if (error.code === "PGRST103") return ok({ items: [], ...meta });
      throw dbError(error);
    }
    return ok({ items: data ?? [], ...meta });
  });
}

/** POST /api/transactions — 등록. 분류의 소유자·유형 일치는 DB 복합 FK가 최종 보장 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const input = parseTxCreate(await readJson(request));
    const { data, error } = await supabase.from("transactions").insert(input).select(TX_COLUMNS).single();
    if (error) throw dbError(error, { fkMessage: TX_FK_MESSAGE });
    return ok(data, 201);
  });
}
