import type { NextRequest } from "next/server";
import { dbError, handle, ok, readJson, requireUser } from "@/lib/api/http";
import { parseTxType } from "@/lib/ledger";
import { requireText } from "@/lib/validate";

const COLUMNS = "id, type, name, created_at";

/** GET /api/transaction-categories?type=income|expense — 내 가계부 분류 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const type = request.nextUrl.searchParams.get("type");
    let query = supabase.from("transaction_categories").select(COLUMNS);
    if (type) query = query.eq("type", parseTxType(type));
    const { data, error } = await query
      .order("type", { ascending: false }) // expense 먼저
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw dbError(error);
    return ok(data ?? []);
  });
}

/** POST /api/transaction-categories — {"type":"expense","name":"카페"}. 같은 유형 내 중복 409 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const body = await readJson(request);
    const input = { type: parseTxType(body.type), name: requireText(body.name, "분류 이름", 50) };
    const { data, error } = await supabase.from("transaction_categories").insert(input).select(COLUMNS).single();
    if (error) throw dbError(error, { duplicateMessage: "같은 유형에 같은 이름의 분류가 이미 있습니다." });
    return ok(data, 201);
  });
}
