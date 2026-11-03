import type { NextRequest } from "next/server";
import { dbError, handle, ok, readJson, requireUser } from "@/lib/api/http";
import { parseCategoryName } from "@/lib/entries";

const COLUMNS = "id, name, created_at";

/** GET /api/entry-categories — 내 분류 목록 (생성 순) */
export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("entry_categories")
      .select(COLUMNS)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw dbError(error);
    return ok(data ?? []);
  });
}

/** POST /api/entry-categories — {"name":"공부"}. 사용자당 중복 금지(409) */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const name = parseCategoryName((await readJson(request)).name);
    const { data, error } = await supabase.from("entry_categories").insert({ name }).select(COLUMNS).single();
    if (error) throw dbError(error, { duplicateMessage: "같은 이름의 분류가 이미 있습니다." });
    return ok(data, 201);
  });
}
