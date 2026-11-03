"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/api/client";
import type { BudgetStatus } from "@/lib/budget";
import type { Dashboard, NamedEntry } from "@/lib/daily";
import { formatKoreanDate, formatKoreanMonth, todayKST } from "@/lib/date";
import { formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

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
  const { todos, categories } = data;
  const [title, setTitle] = useState("");
  const defaultCategory = categories.find((c) => c.name === "일상")?.id ?? categories[0]?.id ?? "";
  const [categoryId, setCategoryId] = useState(defaultCategory);
  const [showDone, setShowDone] = useState(false);
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

  const c = todos.counts;
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
      <p className="mt-1 text-sm text-gray-600">
        오늘 {c.today_total}개 · 완료 {c.today_completed} · 미완료 {c.today_incomplete}
        {c.previous_incomplete > 0 && <span className="ml-1 font-semibold text-amber-800">· 이전 미완료 {c.previous_incomplete}</span>}
      </p>

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

      {todos.focus.length === 0 ? (
        <p className="mt-4 rounded bg-gray-50 p-4 text-center text-sm text-gray-600">남은 할 일이 없습니다. 👏</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {todos.focus.map((t) => (
            <TodoRow key={t.id} t={t} today={today} busy={busyId === t.id} onToggle={() => toggle(t)} />
          ))}
        </ul>
      )}

      {todos.completed_today.length > 0 && (
        <div className="mt-4">
          <button type="button" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)} className="text-sm text-gray-600 underline">
            오늘 완료한 일 {todos.completed_today.length}개 {showDone ? "접기 ▲" : "펼치기 ▼"}
          </button>
          {showDone && (
            <ul className="mt-2 divide-y divide-gray-100">
              {todos.completed_today.map((t) => (
                <TodoRow key={t.id} t={t} today={today} busy={busyId === t.id} onToggle={() => toggle(t)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TodoRow({ t, today, busy, onToggle }: { t: NamedEntry; today: string; busy: boolean; onToggle: () => void }) {
  const previous = t.record_date < today;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={!!t.is_completed}
        disabled={busy}
        onChange={onToggle}
        aria-label={`${t.title} ${t.is_completed ? "완료 취소" : "완료"}`}
        className="h-5 w-5 shrink-0 accent-blue-600"
      />
      <span className={`min-w-0 flex-1 break-words text-base ${t.is_completed ? "text-gray-500 line-through" : "text-gray-900"}`}>
        {t.title}
      </span>
      {previous && (
        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">{formatKoreanDate(t.record_date)}</span>
      )}
      {t.due_date && <span className="shrink-0 text-xs text-gray-500">마감 {formatKoreanDate(t.due_date)}</span>}
      {t.category_name && <span className="hidden shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 sm:inline">{t.category_name}</span>}
    </li>
  );
}
