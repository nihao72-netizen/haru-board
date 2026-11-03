"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import { addDays } from "@/lib/date";
import type { Entry, EntryCategory } from "@/lib/entries";
import { relativeDateLabel } from "@/lib/quick-parse";
import { QuickAdd } from "./quick-add";
import { groupLabel, PRIORITY, TaskRow, type ListResult, type Task } from "./todo-shared";

export type ViewProps = {
  today: string;
  categories: EntryCategory[];
  reloadToken: number;
  hidden: ReadonlySet<string>; // 방금 완료해 사라지는 중인 작업
  onToggle: (task: Task) => void;
  onOpen: (id: string) => void;
  onCreated: (entry: Entry, createdCategory: boolean) => void;
};

/** 목록 불러오기 (url이나 reloadToken이 바뀌면 다시) */
function useTasks(url: string | null, reloadToken: number) {
  const [state, setState] = useState<{ key: string; items: Task[]; error: string | null } | null>(null);
  const key = `${url}#${reloadToken}`;
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api<ListResult<Task>>(url)
      .then((r) => !cancelled && setState({ key, items: r.items, error: null }))
      .catch((e) => !cancelled && setState({ key, items: [], error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [url, key]);
  // 다시 불러오는 동안에는 이전 목록을 유지(깜빡임 방지)
  return { items: state?.items ?? [], error: state?.error ?? null, loading: state?.key !== key, ready: state !== null };
}

const catMap = (cats: EntryCategory[]) => new Map(cats.map((c) => [c.id, c]));

function AddInline(props: ViewProps & { date: string; categoryId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 flex items-center gap-2 px-1 py-1.5 text-sm text-gray-500 hover:text-red-600">
        <span className="text-lg leading-none text-red-600">＋</span> {props.label ?? "작업 추가"}
      </button>
    );
  }
  return (
    <div className="mt-2">
      <QuickAdd
        today={props.today}
        categories={props.categories}
        defaultDate={props.date}
        defaultCategoryId={props.categoryId}
        autoFocus
        onCreated={props.onCreated}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

function TaskList(props: ViewProps & { items: Task[]; showDate?: boolean }) {
  const cats = useMemo(() => catMap(props.categories), [props.categories]);
  const visible = props.items.filter((t) => !props.hidden.has(t.id));
  if (visible.length === 0) return null;
  return (
    <ul>
      {visible.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          today={props.today}
          category={cats.get(t.category_id)}
          showDate={props.showDate}
          onToggle={() => props.onToggle(t)}
          onOpen={() => props.onOpen(t.id)}
        />
      ))}
    </ul>
  );
}

function Status({ loading, error, ready }: { loading: boolean; error: string | null; ready: boolean }) {
  if (error) return <p role="alert" className="py-3 text-sm text-red-700">불러오지 못했습니다: {error}</p>;
  if (!ready && loading) return <p className="py-3 text-sm text-gray-500">불러오는 중…</p>;
  return null;
}

// ─────────────────────────── 오늘 ───────────────────────────
export function TodayView(props: ViewProps) {
  const { today } = props;
  const open = useTasks(`/api/entries?type=todo&status=incomplete&from=2000-01-01&to=${today}&top_level=true&sort=schedule&with_subtasks=true&limit=500`, props.reloadToken);
  const done = useTasks(`/api/entries?type=todo&status=completed&date=${today}&top_level=true&with_subtasks=true&limit=100`, props.reloadToken);
  const [showDone, setShowDone] = useState(false);
  const overdue = open.items.filter((t) => t.record_date < today && !props.hidden.has(t.id));
  const todays = open.items.filter((t) => t.record_date === today && !props.hidden.has(t.id));
  const count = overdue.length + todays.length;

  return (
    <div>
      <h2 className="text-2xl font-bold">오늘</h2>
      <p className="mt-1 text-sm text-gray-500">✓ {count}개 작업</p>
      <Status {...open} />
      {overdue.length > 0 && (
        <section className="mt-5" aria-label="기한 지남">
          <h3 className="border-b border-gray-200 pb-1 text-sm font-bold text-red-700">기한 지남 · {overdue.length}</h3>
          <TaskList {...props} items={overdue} showDate />
        </section>
      )}
      <section className="mt-5" aria-label="오늘 할 일">
        <h3 className="border-b border-gray-200 pb-1 text-sm font-bold">{groupLabel(today, today)}</h3>
        <TaskList {...props} items={todays} />
        <AddInline {...props} date={today} />
      </section>
      {done.items.length > 0 && (
        <section className="mt-5">
          <button type="button" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)} className="text-sm text-gray-500 hover:underline">
            오늘 완료 {done.items.length}개 {showDone ? "접기 ▲" : "보기 ▼"}
          </button>
          {showDone && <TaskList {...props} items={done.items} hidden={new Set()} />}
        </section>
      )}
    </div>
  );
}

// ─────────────────────────── 다음 ───────────────────────────
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const sundayOf = (date: string) => addDays(date, -new Date(`${date}T00:00:00Z`).getUTCDay());

export function UpcomingView(props: ViewProps) {
  const { today } = props;
  const [weekStart, setWeekStart] = useState(sundayOf(today));
  const [days, setDays] = useState(21);
  const start = weekStart < today ? today : weekStart;
  const end = addDays(start, days - 1);
  const list = useTasks(`/api/entries?type=todo&status=incomplete&from=${start}&to=${end}&top_level=true&sort=schedule&with_subtasks=true&limit=500`, props.reloadToken);
  const byDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of list.items) {
      if (props.hidden.has(t.id)) continue;
      m.set(t.record_date, [...(m.get(t.record_date) ?? []), t]);
    }
    return m;
  }, [list.items, props.hidden]);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const strip = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function jump(date: string) {
    const ws = sundayOf(date);
    setWeekStart(ws);
    // 렌더 후 그 날짜로 스크롤
    setTimeout(() => document.getElementById(`day-${date < today ? today : date}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold">다음</h2>
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="text-sm font-semibold text-gray-700">
          <span className="sr-only">월 선택</span>
          <input
            type="month"
            value={weekStart.slice(0, 7)}
            onChange={(e) => e.target.value && jump(`${e.target.value}-01` < today ? today : `${e.target.value}-01`)}
            className="rounded border border-transparent px-1 py-0.5 hover:border-gray-200"
          />
        </label>
        <div className="flex items-center gap-1 text-sm">
          <button type="button" aria-label="이전 주" onClick={() => setWeekStart((w) => addDays(w, -7))} disabled={weekStart <= sundayOf(today)} className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-30">
            ‹
          </button>
          <button type="button" onClick={() => jump(today)} className="rounded border border-gray-200 px-2 py-0.5 hover:bg-gray-50">
            오늘
          </button>
          <button type="button" aria-label="다음 주" onClick={() => setWeekStart((w) => addDays(w, 7))} className="rounded px-2 py-1 hover:bg-gray-100">
            ›
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 rounded-lg border border-gray-200 p-1 text-center" role="tablist" aria-label="주간 날짜">
        {strip.map((d) => {
          const past = d < today;
          const isToday = d === today;
          const n = byDate.get(d)?.length ?? 0;
          return (
            <button
              key={d}
              type="button"
              disabled={past}
              onClick={() => jump(d)}
              className={`rounded py-1 text-xs ${isToday ? "bg-red-600 font-bold text-white" : past ? "text-gray-300" : "text-gray-700 hover:bg-gray-100"}`}
            >
              <span className="block">{WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
              <span className="block text-sm">{Number(d.slice(8))}</span>
              <span className={`block h-1 ${n ? "" : "invisible"}`}>•</span>
            </button>
          );
        })}
      </div>
      <Status {...list} />
      {dates.map((d) => (
        <section key={d} id={`day-${d}`} className="mt-5 scroll-mt-4" aria-label={groupLabel(d, today)}>
          <h3 className="border-b border-gray-200 pb-1 text-sm font-bold">{groupLabel(d, today)}</h3>
          <TaskList {...props} items={byDate.get(d) ?? []} />
          <AddInline {...props} date={d} />
        </section>
      ))}
      <div className="mt-6 text-center">
        <button type="button" onClick={() => setDays((n) => n + 14)} className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">
          2주 더 보기
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── 캘린더 ───────────────────────────
export function CalendarView(props: ViewProps) {
  const { today } = props;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const first = `${month}-01`;
  const gridStart = sundayOf(first);
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const gridEnd = addDays(sundayOf(lastDay), 6);
  const list = useTasks(`/api/entries?type=todo&from=${gridStart}&to=${gridEnd}&top_level=true&sort=schedule&with_subtasks=true&limit=500`, props.reloadToken);
  const byDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of list.items) m.set(t.record_date, [...(m.get(t.record_date) ?? []), t]);
    return m;
  }, [list.items]);
  const cells: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(d);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const dayTasks = byDate.get(selected) ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">
          {month.slice(0, 4)}년 {Number(month.slice(5))}월
        </h2>
        <div className="flex items-center gap-1 text-sm">
          <button type="button" aria-label="이전 달" onClick={() => shift(-1)} className="rounded px-2 py-1 hover:bg-gray-100">‹</button>
          <button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }} className="rounded border border-gray-200 px-2 py-0.5 hover:bg-gray-50">
            오늘
          </button>
          <button type="button" aria-label="다음 달" onClick={() => shift(1)} className="rounded px-2 py-1 hover:bg-gray-100">›</button>
        </div>
      </div>
      <Status {...list} />
      <div className="mt-3 grid grid-cols-7 border-l border-t border-gray-200 text-xs" role="grid" aria-label="월간 캘린더">
        {WEEK.map((w, i) => (
          <div key={w} role="columnheader" className={`border-b border-r border-gray-200 bg-gray-50 py-1 text-center font-semibold ${i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : "text-gray-600"}`}>
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month;
          const tasks = byDate.get(d) ?? [];
          const isSel = d === selected;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={`${relativeDateLabel(d, today)}, 작업 ${tasks.length}개`}
              onClick={() => setSelected(d)}
              className={`flex min-h-[72px] flex-col border-b border-r border-gray-200 p-1 text-left align-top sm:min-h-[96px] ${inMonth ? "bg-white" : "bg-gray-50 text-gray-400"} ${isSel ? "ring-2 ring-inset ring-red-400" : "hover:bg-red-50/40"}`}
            >
              <span className={`mb-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${d === today ? "bg-red-600 font-bold text-white" : ""}`}>
                {Number(d.slice(8))}
              </span>
              {tasks.slice(0, 3).map((t) => (
                <span key={t.id} className={`truncate rounded px-1 leading-4 ${t.is_completed ? "text-gray-400 line-through" : "text-gray-800"}`}>
                  <span className={PRIORITY[t.priority].text} aria-hidden="true">●</span> {t.title}
                </span>
              ))}
              {tasks.length > 3 && <span className="px-1 text-gray-500">+{tasks.length - 3}개</span>}
            </button>
          );
        })}
      </div>
      <section className="mt-5" aria-label="선택한 날짜의 작업">
        <h3 className="border-b border-gray-200 pb-1 text-sm font-bold">{groupLabel(selected, today)}</h3>
        {dayTasks.length === 0 && <p className="py-2 text-sm text-gray-500">이날 작업이 없습니다.</p>}
        <TaskList {...props} items={dayTasks} hidden={new Set()} />
        <AddInline key={selected} {...props} date={selected} />
      </section>
    </div>
  );
}

// ─────────────────────────── 분류 ───────────────────────────
export function CategoryView(props: ViewProps & { category: EntryCategory }) {
  const { today, category } = props;
  const list = useTasks(`/api/entries?type=todo&status=incomplete&category_id=${category.id}&from=2000-01-01&top_level=true&sort=schedule&with_subtasks=true&limit=500`, props.reloadToken);
  const items = list.items.filter((t) => !props.hidden.has(t.id));
  return (
    <div>
      <h2 className="text-2xl font-bold"># {category.name}</h2>
      <p className="mt-1 text-sm text-gray-500">미완료 {items.length}개</p>
      <Status {...list} />
      <div className="mt-4">
        <TaskList {...props} items={items} showDate />
        <AddInline {...props} date={today} categoryId={category.id} />
      </div>
    </div>
  );
}
