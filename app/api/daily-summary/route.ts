import type { NextRequest } from "next/server";
import { dbError, handle, ok, requireUser } from "@/lib/api/http";
import { DAILY_REVIEW_COLUMNS, parseDateParam, withCategoryName, type DailySummary, type NamedEntry } from "@/lib/daily";
import { todayKST } from "@/lib/date";
import { ENTRY_COLUMNS, type Entry } from "@/lib/entries";
import { findLearning } from "@/lib/hanja";
import { TX_COLUMNS, type Transaction } from "@/lib/ledger";
import { listAttempts } from "@/lib/quiz";

const MAX_ROWS = 1000; // 하루 기록 상한 (초과 시 truncated)

/**
 * GET /api/daily-summary?date=YYYY-MM-DD — 하루 마무리 통합 조회 (PRD 4.8, 8.12). 읽기 전용.
 * 원본 테이블에서 실시간 조회: 할 일·메모(record_date), 거래(transaction_date),
 * 한자 학습(learning_date), 퀴즈·복습 시도(attempted_at의 서울 날짜), 일기.
 * 할 일 완료 여부는 그날 당시가 아니라 현재 상태를 반영한다.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const date = parseDateParam(request.nextUrl.searchParams.get("date"), todayKST());

    const [entries, entryCats, txs, txCats, learning, daily, review, diary] = await Promise.all([
      supabase
        .from("entries")
        .select(ENTRY_COLUMNS)
        .eq("record_date", date)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(MAX_ROWS),
      supabase.from("entry_categories").select("id, name"),
      supabase
        .from("transactions")
        .select(TX_COLUMNS)
        .eq("transaction_date", date)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(MAX_ROWS),
      supabase.from("transaction_categories").select("id, name"),
      findLearning(supabase, "learning_date", date),
      listAttempts(supabase, { type: "daily", date, from: 0, to: 99 }),
      listAttempts(supabase, { type: "review", date, from: 0, to: 99 }),
      supabase.from("daily_reviews").select(DAILY_REVIEW_COLUMNS).eq("review_date", date).maybeSingle(),
    ]);
    for (const r of [entries, entryCats, txs, txCats, diary]) if (r.error) throw dbError(r.error);

    const entryNames = new Map((entryCats.data ?? []).map((c) => [c.id as string, c.name as string]));
    const txNames = new Map((txCats.data ?? []).map((c) => [c.id as string, c.name as string]));
    const named: NamedEntry[] = withCategoryName((entries.data ?? []) as Entry[], entryNames);
    const todos = named.filter((e) => e.type === "todo");
    const memos = named.filter((e) => e.type === "memo");
    const txList = withCategoryName((txs.data ?? []) as Transaction[], txNames);
    const income = txList.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = txList.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    const summary: DailySummary = {
      date,
      todos: {
        items: todos,
        total: todos.length,
        completed: todos.filter((t) => t.is_completed).length,
        incomplete: todos.filter((t) => !t.is_completed).length,
      },
      memos: { items: memos, total: memos.length },
      finance: {
        items: txList,
        total_income: income,
        total_expense: expense,
        balance: income - expense,
        truncated: txList.length >= MAX_ROWS,
      },
      hanja: { learning, daily_attempts: daily.items, review_attempts: review.items },
      diary: diary.data ?? null,
    };
    return ok(summary);
  });
}
