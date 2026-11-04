import { dbError, handle, ok, requireUser } from "@/lib/api/http";
import { budgetLine, fetchTransactionsInRange, findMonthlyBudget, parseMonth } from "@/lib/budget";
import { HOME_PREVIEW, mergeByDistance, withCategoryName, type Dashboard } from "@/lib/daily";
import { todayKST } from "@/lib/date";
import { ENTRY_COLUMNS, type Entry, type EntryCategory } from "@/lib/entries";
import { findLearning } from "@/lib/hanja";

const LIST_LIMIT = 100;

/**
 * GET /api/dashboard — 홈 화면 (PRD 4.9, 8.12). 읽기 전용:
 * 한자 신규 배정이나 주간 복습 회차 생성을 하지 않는다 (각각 별도 POST API).
 * 할 일 집합(PRD 4.2): type=todo AND (record_date=오늘 OR (record_date<오늘 AND 미완료))
 */
export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const today = todayKST();
    const { month, first, start, end } = parseMonth(today.slice(0, 7));
    const todo = () => supabase.from("entries").select(ENTRY_COLUMNS, { count: "exact" }).eq("type", "todo");
    const count = () => supabase.from("entries").select("id", { count: "exact", head: true }).eq("type", "todo");
    // 홈 세 칸용 (하위 작업 제외)
    const top = () => todo().is("parent_id", null);
    const topCount = () => count().is("parent_id", null);
    const todayStart = `${today}T00:00:00+09:00`;

    const [
      [focus, completedToday, todayTotal, todayDone, previousOpen, cats, monthTx, monthly, learning, reviews, diary],
      [homeDone, homeToday, homeOverdue, homeLater, doneTodayCount, todayOpenCount, overdueCount, laterCount],
    ] = await Promise.all([
      Promise.all([
        // 강조 목록: 미완료 (오늘 + 이전). 오래된 것부터
        todo()
          .eq("is_completed", false)
          .lte("record_date", today)
          .order("record_date", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(LIST_LIMIT),
        todo()
          .eq("is_completed", true)
          .eq("record_date", today)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: true })
          .limit(LIST_LIMIT),
        count().eq("record_date", today),
        count().eq("record_date", today).eq("is_completed", true),
        count().lt("record_date", today).eq("is_completed", false),
        supabase.from("entry_categories").select("id, name, created_at").order("created_at", { ascending: true }),
        fetchTransactionsInRange(supabase, start, end),
        findMonthlyBudget(supabase, first),
        findLearning(supabase, "learning_date", today),
        supabase.from("weekly_reviews").select("id", { count: "exact", head: true }).neq("status", "completed"),
        supabase.from("daily_reviews").select("id", { count: "exact", head: true }).eq("review_date", today),
      ]),
      // 홈 세 칸 (각 5개)
      Promise.all([
        top().eq("is_completed", true).order("updated_at", { ascending: false }).order("id").limit(HOME_PREVIEW),
        top()
          .eq("is_completed", false)
          .eq("record_date", today)
          .order("scheduled_time", { ascending: true, nullsFirst: false })
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(HOME_PREVIEW),
        top()
          .eq("is_completed", false)
          .lt("record_date", today)
          .order("record_date", { ascending: false })
          .order("scheduled_time", { ascending: true, nullsFirst: false })
          .order("priority", { ascending: true })
          .limit(HOME_PREVIEW),
        top()
          .eq("is_completed", false)
          .gt("record_date", today)
          .order("record_date", { ascending: true })
          .order("scheduled_time", { ascending: true, nullsFirst: false })
          .order("priority", { ascending: true })
          .limit(HOME_PREVIEW),
        topCount().eq("is_completed", true).gte("updated_at", todayStart),
        topCount().eq("is_completed", false).eq("record_date", today),
        topCount().eq("is_completed", false).lt("record_date", today),
        topCount().eq("is_completed", false).gt("record_date", today),
      ]),
    ]);
    const results = [focus, completedToday, todayTotal, todayDone, previousOpen, cats, reviews, diary];
    for (const r of [...results, homeDone, homeToday, homeOverdue, homeLater, doneTodayCount, todayOpenCount, overdueCount, laterCount]) {
      if (r.error) throw dbError(r.error);
    }

    const categories = (cats.data ?? []) as EntryCategory[];
    const names = new Map(categories.map((c) => [c.id, c.name]));
    let todayIncome = 0;
    let todayExpense = 0;
    let monthExpense = 0;
    for (const t of monthTx) {
      if (t.type === "expense") monthExpense += t.amount;
      if (t.transaction_date !== today) continue;
      if (t.type === "income") todayIncome += t.amount;
      else todayExpense += t.amount;
    }
    const total = todayTotal.count ?? 0;
    const done = todayDone.count ?? 0;

    const dashboard: Dashboard = {
      date: today,
      todos: {
        focus: withCategoryName((focus.data ?? []) as Entry[], names),
        completed_today: withCategoryName((completedToday.data ?? []) as Entry[], names),
        counts: {
          today_total: total,
          today_completed: done,
          today_incomplete: total - done,
          previous_incomplete: previousOpen.count ?? 0,
        },
        home: {
          done: withCategoryName((homeDone.data ?? []) as Entry[], names),
          today: withCategoryName((homeToday.data ?? []) as Entry[], names),
          pending: withCategoryName(mergeByDistance((homeOverdue.data ?? []) as Entry[], (homeLater.data ?? []) as Entry[], today, HOME_PREVIEW), names),
          counts: {
            done_today: doneTodayCount.count ?? 0,
            today: todayOpenCount.count ?? 0,
            overdue: overdueCount.count ?? 0,
            later: laterCount.count ?? 0,
          },
        },
      },
      categories,
      finance: {
        today_income: todayIncome,
        today_expense: todayExpense,
        month,
        month_expense: monthExpense,
        budget: budgetLine(monthly ? Number(monthly.amount) : null, monthExpense),
      },
      hanja: { today: learning, open_review_count: reviews.count ?? 0 },
      diary: { written: (diary.count ?? 0) > 0 },
    };
    return ok(dashboard);
  });
}
