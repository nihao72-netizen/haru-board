"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/api/client";
import type { BudgetStatus } from "@/lib/budget";
import type { Dashboard, NamedEntry } from "@/lib/daily";
import { formatKoreanDate, formatKoreanMonth, todayKST } from "@/lib/date";
import { formatWon } from "@/lib/format";
import { relativeDateLabel, timeLabel } from "@/lib/quick-parse";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, dateTimeLabel, dateTone } from "./todos/todo-shared";

const card = "rounded-lg bg-white p-4 shadow sm:p-6";
const budgetMeta: Record<BudgetStatus, { label: string; className: string }> = {
  normal: { label: "● 정상", className: "bg-green-100 text-green-800" },
  warning: { label: "▲ 주의", className: "bg-amber-100 text-amber-900" },
  limit_reached: { label: "■ 한도 도달", className: "bg-orange-100 text-orange-900" },
  exceeded: { label: "✕ 초과", className: "bg-red-100 text-red-800" },
  not_set: { label: "예산 미설정", className: "bg-gray-100 text-gray-600" },
};
const hanjaStatus = { assigned: "배정됨", studying: "학습 중", completed: "✓ 학습 완료" } as const;

/** 로그인 전 소개 카드 (기존 홈 화면 내용) */
function Intro() {
  return (
    <>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold">할 일</h2>
          <p>오늘 해야 할 일을 관리합니다.</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold">가계부</h2>
          <p>매일의 지출을 기록합니다.</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold">천자문</h2>
          <p>한자를 공부하고 복습합니다.</p>
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Link href="/login" className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          로그인
        </Link>
        <Link href="/signup" className="rounded bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow hover:bg-gray-50">
          회원가입
        </Link>
      </div>
    </>
  );
}

export function HomeDashboard() {
  const today = todayKST();
  const [token, setToken] = useState(0);
  const [data, setData] = useState<Dashboard | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 로그인 세션이 없으면 API를 부르지 않고 소개 화면 (불필요한 401 방지)
    const supabase = createClient();
    const session = supabase ? supabase.auth.getSession().then(({ data: s }) => !!s.session) : Promise.resolve(false);
    session
      .then((signedIn) => {
        if (!signedIn) throw new ClientApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
        return api<Dashboard>("/api/dashboard");
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        // 로그인하지 않았거나 Supabase 미설정이면 소개 화면
        if (e instanceof ClientApiError && (e.status === 401 || e.code === "NOT_CONFIGURED")) setSignedOut(true);
        else setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const reload = () => setToken((t) => t + 1);

  if (signedOut) return <Intro />;
  if (error && !data) {
    return (
      <div role="alert" className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        오늘의 정보를 불러오지 못했습니다: {error}
        <button type="button" className="ml-2 underline" onClick={reload}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!data) return <div className="mt-8 rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>;

  const { finance, hanja } = data;
  const budget = budgetMeta[finance.budget.status];

  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-3">
      <TodoCard data={data} today={today} onChanged={reload} />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:content-start">
        <Link href="/ledger" className={`${card} block hover:ring-2 hover:ring-blue-200`}>
          <h2 className="font-bold">가계부</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">오늘 수입</dt>
              <dd className="font-medium text-blue-800">{formatWon(finance.today_income)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">오늘 지출</dt>
              <dd className="font-medium text-red-800">{formatWon(finance.today_expense)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-gray-100 pt-1">
              <dt className="text-gray-500">{Number(finance.month.slice(5))}월 지출</dt>
              <dd className="font-medium">{formatWon(finance.month_expense)}</dd>
            </div>
          </dl>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className={`rounded px-1.5 py-0.5 font-semibold ${budget.className}`}>{budget.label}</span>
            {finance.budget.budget !== null && (
              <span>
                {formatKoreanMonth(finance.month)} 예산 {formatWon(finance.budget.budget)} 중 {finance.budget.usage_rate}%
              </span>
            )}
          </p>
        </Link>

        <Link href="/hanja" className={`${card} block hover:ring-2 hover:ring-blue-200`}>
          <h2 className="font-bold">오늘의 한자</h2>
          {hanja.today ? (
            <p className="mt-2 flex items-center gap-3">
              <span className="font-serif text-4xl" lang="zh-Hant">
                {hanja.today.character.character}
              </span>
              <span className="text-sm">
                {hanja.today.character.meaning} {hanja.today.character.reading}
                <span className="mt-1 block text-xs text-gray-600">{hanjaStatus[hanja.today.status]}</span>
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-600">아직 받지 않았어요. 눌러서 오늘의 한자를 받으세요.</p>
          )}
          <p className="mt-2 text-xs text-gray-600">
            {hanja.open_review_count > 0 ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                미완료 복습 {hanja.open_review_count}회차
              </span>
            ) : (
              "미완료 복습 없음"
            )}
          </p>
        </Link>

        <Link href="/daily" className={`${card} block hover:ring-2 hover:ring-blue-200`}>
          <h2 className="font-bold">하루 마무리</h2>
          <p className="mt-2 text-sm text-gray-700">
            {data.diary.written ? "✓ 오늘 일기를 썼어요." : "오늘 일기를 아직 쓰지 않았어요."}
          </p>
          <p className="mt-1 text-xs text-gray-500">하루 기록을 모아 보고 일기를 남겨요.</p>
        </Link>
      </div>
    </div>
  );
}

function TodoCard({ data, today, onChanged }: { data: Dashboard; today: string; onChanged: () => void }) {
  const { categories } = data;
  const home = data.todos.home;
  const [title, setTitle] = useState("");
  const defaultCategory = categories.find((c) => c.name === "일상")?.id ?? categories[0]?.id ?? "";
  const [categoryId, setCategoryId] = useState(defaultCategory);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const selectedCategory = categories.some((c) => c.id === categoryId) ? categoryId : defaultCategory;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setMessage({ kind: "error", text: "할 일 제목을 입력해 주세요." });
    if (!selectedCategory) return setMessage({ kind: "error", text: "분류가 없습니다. 할 일 화면에서 분류를 먼저 추가해 주세요." });
    setBusyId("new");
    try {
      await api("/api/entries", {
        method: "POST",
        body: JSON.stringify({ type: "todo", category_id: selectedCategory, record_date: today, title }),
      });
      setTitle("");
      setMessage({ kind: "success", text: "할 일을 추가했습니다." });
      onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: `추가하지 못했습니다: ${errorMessage(err)}` });
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(t: NamedEntry) {
    setBusyId(t.id);
    try {
      await api(`/api/entries/${t.id}`, { method: "PATCH", body: JSON.stringify({ is_completed: !t.is_completed }) });
      onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: `변경하지 못했습니다: ${errorMessage(err)}` });
    } finally {
      setBusyId(null);
    }
  }

  const c = home.counts;
  const row = (t: NamedEntry, meta: React.ReactNode) => <TodoRow key={t.id} t={t} meta={meta} busy={busyId === t.id} onToggle={() => toggle(t)} />;
  return (
    <section className={`${card} lg:col-span-2`} aria-labelledby="home-todos">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="home-todos" className="text-2xl font-bold">
          {formatKoreanDate(today)} 할 일
        </h2>
        <Link href="/todos" className="text-sm text-blue-700 hover:underline">
          전체 보기 →
        </Link>
      </div>

      <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="quick-todo" className="sr-only">
          새 할 일
        </label>
        <input
          id="quick-todo"
          value={title}
          maxLength={200}
          placeholder="오늘 할 일을 빠르게 추가"
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          aria-label="분류"
          value={selectedCategory}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-2 text-sm"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busyId === "new"}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          추가
        </button>
      </form>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`mt-2 text-sm ${message.kind === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-5 space-y-5">
        <TodoSection id="home-done" title="한 일" tone="text-gray-700" summary={`오늘 ${c.done_today}개 완료 · 최근 완료순`} href="/todos?view=all" empty="아직 완료한 일이 없어요.">
          {home.done.map((t) => row(t, <span className="text-gray-500">{doneLabel(t.updated_at, today)}</span>))}
        </TodoSection>

        <TodoSection id="home-today" title="오늘 할 일" tone="text-green-700" summary={`${c.today}개 남음 · 시간순`} href="/todos?view=today" empty="오늘 할 일을 모두 끝냈어요. 👏">
          {home.today.map((t) => row(t, t.scheduled_time ? <span className="text-green-700">{timeLabel(t.scheduled_time)}</span> : null))}
        </TodoSection>

        <TodoSection
          id="home-pending"
          title="해야 될 일"
          tone="text-purple-700"
          summary={
            <>
              {c.overdue > 0 && <span className="font-semibold text-red-700">기한 지남 {c.overdue} · </span>}
              내일 이후 {c.later} · 가까운 날짜순
            </>
          }
          href="/todos?view=today"
          empty="남은 일이 없어요."
        >
          {home.pending.map((t) =>
            row(
              t,
              <span className={dateTone(t.record_date, today)}>
                {t.record_date < today && "⚠ "}
                {dateTimeLabel(t.record_date, t.scheduled_time, today)}
              </span>,
            ),
          )}
        </TodoSection>
      </div>
    </section>
  );
}

const seoulDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
const seoulClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** 완료한 때 (마지막 수정 시각 기준): 오늘이면 시각, 아니면 어제·날짜 */
function doneLabel(iso: string, today: string) {
  const d = new Date(iso);
  const date = seoulDate.format(d);
  return date === today ? `오늘 ${timeLabel(seoulClock.format(d))}` : relativeDateLabel(date, today);
}

function TodoSection(props: { id: string; title: string; tone: string; summary: React.ReactNode; href: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section aria-labelledby={props.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-gray-200 pb-1">
        <h3 id={props.id} className={`text-base font-bold ${props.tone}`}>
          {props.title}
          <span className="ml-2 text-xs font-normal text-gray-500">{props.summary}</span>
        </h3>
        <Link href={props.href} className="text-xs text-blue-700 hover:underline">
          전체 보기 →
        </Link>
      </div>
      {props.children.length === 0 ? <p className="py-3 text-sm text-gray-500">{props.empty}</p> : <ul className="divide-y divide-gray-100">{props.children}</ul>}
    </section>
  );
}

function TodoRow({ t, meta, busy, onToggle }: { t: NamedEntry; meta: React.ReactNode; busy: boolean; onToggle: () => void }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <CheckCircle priority={t.priority} done={!!t.is_completed} title={t.title ?? ""} disabled={busy} onToggle={onToggle} />
      <span className={`min-w-0 flex-1 break-words text-sm ${t.is_completed ? "text-gray-500 line-through" : "text-gray-900"}`}>{t.title}</span>
      {meta && <span className="shrink-0 text-xs">{meta}</span>}
      {t.category_name && <span className="hidden shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 sm:inline">{t.category_name}</span>}
    </li>
  );
}
