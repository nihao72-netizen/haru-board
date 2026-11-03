"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import { todayKST } from "@/lib/date";
import type { Entry, EntryCategory } from "@/lib/entries";
import { QuickAdd } from "./quick-add";
import { TaskDetail } from "./task-detail";
import { TodoBoard } from "./todo-board";
import { Toast, type ListResult, type Task, type ToastState } from "./todo-shared";
import { CalendarView, CategoryView, TodayView, UpcomingView, type ViewProps } from "./views";

type View = "today" | "upcoming" | "calendar" | "all" | `cat:${string}`;
const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: "today", label: "오늘", icon: "📅" },
  { id: "upcoming", label: "다음", icon: "🗓️" },
  { id: "calendar", label: "캘린더", icon: "▦" },
  { id: "all", label: "전체 기록·메모", icon: "☰" },
];

export function TodoApp() {
  const today = todayKST();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = (params.get("view") ?? "today") as View;
  const taskId = params.get("task");

  const [categories, setCategories] = useState<EntryCategory[]>([]);
  const [catToken, setCatToken] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [counts, setCounts] = useState<{ today: number; byCat: Map<string, number> }>({ today: 0, byCat: new Map() });
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);
  const showToast = useCallback((text: string, undo?: () => void) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text, undo })), [setToast]);

  /** 주소의 보기·작업을 바꾼다 (새로고침해도 유지) */
  const navigate = useCallback(
    (next: { view?: View; task?: string | null }) => {
      const q = new URLSearchParams(params.toString());
      if (next.view) q.set("view", next.view);
      if (next.task === null) q.delete("task");
      else if (next.task) q.set("task", next.task);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    let cancelled = false;
    api<EntryCategory[]>("/api/entry-categories")
      .then((c) => !cancelled && setCategories(c))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [catToken]);

  // 사이드바 개수: 오늘(기한 지남 포함) / 분류별 미완료
  useEffect(() => {
    let cancelled = false;
    api<ListResult<Task>>(`/api/entries?type=todo&status=incomplete&from=2000-01-01&top_level=true&limit=500`)
      .then((r) => {
        if (cancelled) return;
        const byCat = new Map<string, number>();
        let t = 0;
        for (const e of r.items) {
          if (e.record_date <= today) t++;
          byCat.set(e.category_id, (byCat.get(e.category_id) ?? 0) + 1);
        }
        setCounts({ today: t, byCat });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadToken, today]);

  // 단축키: Q 빠른 추가, G 다음 T/U/C 보기 이동 (입력 중에는 무시)
  useEffect(() => {
    let g = false;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]") || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (g) {
        g = false;
        if (k === "t") navigate({ view: "today" });
        else if (k === "u") navigate({ view: "upcoming" });
        else if (k === "c") navigate({ view: "calendar" });
        return;
      }
      if (k === "q") {
        e.preventDefault();
        setQuickOpen(true);
      } else if (k === "g") g = true;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const toggle = useCallback(
    async (task: Task) => {
      const completing = !task.is_completed;
      if (completing) setHidden((h) => new Set(h).add(task.id));
      try {
        await api(`/api/entries/${task.id}`, { method: "PATCH", body: JSON.stringify({ is_completed: completing }) });
        if (completing) {
          let first = false;
          try {
            first = !localStorage.getItem("haru:first-complete");
            localStorage.setItem("haru:first-complete", "1");
          } catch {}
          showToast(first ? "🎉 첫 작업을 완료했어요!" : "작업을 완료했습니다", async () => {
            await api(`/api/entries/${task.id}`, { method: "PATCH", body: JSON.stringify({ is_completed: false }) }).catch(() => {});
            setHidden((h) => {
              const n = new Set(h);
              n.delete(task.id);
              return n;
            });
            reload();
          });
        }
        reload();
      } catch (e) {
        setHidden((h) => {
          const n = new Set(h);
          n.delete(task.id);
          return n;
        });
        showToast(`변경하지 못했습니다: ${errorMessage(e)}`);
      }
    },
    [reload, showToast],
  );

  const onCreated = useCallback(
    (entry: Entry, createdCategory: boolean) => {
      if (createdCategory) setCatToken((t) => t + 1);
      showToast(`'${entry.title}'을(를) 추가했습니다`);
      reload();
    },
    [reload, showToast],
  );

  const viewProps: ViewProps = { today, categories, reloadToken, hidden, onToggle: (t) => void toggle(t), onOpen: (id) => navigate({ task: id }), onCreated };
  const currentCat = view.startsWith("cat:") ? categories.find((c) => c.id === view.slice(4)) : undefined;
  const navClass = (active: boolean) =>
    `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm md:w-full ${active ? "bg-red-50 font-semibold text-red-700" : "text-gray-700 hover:bg-gray-100"}`;
  const sortedCats = useMemo(() => [...categories].sort((a, b) => a.created_at.localeCompare(b.created_at)), [categories]);

  return (
    <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start">
      {/* 사이드바 (좁은 화면에서는 위쪽 가로 메뉴) */}
      <aside className="md:sticky md:top-4 md:w-56 md:shrink-0" aria-label="할 일 메뉴">
        <div className="rounded-xl bg-[#fcfaf8] p-2 ring-1 ring-gray-200">
          <button type="button" onClick={() => setQuickOpen(true)} className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white">＋</span> 작업 추가
            <kbd className="ml-auto hidden rounded border border-gray-200 px-1 text-[10px] font-normal text-gray-400 md:inline">Q</kbd>
          </button>
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-current={view === v.id ? "page" : undefined} onClick={() => navigate({ view: v.id })} className={navClass(view === v.id)}>
                <span aria-hidden="true">{v.icon}</span> {v.label}
                {v.id === "today" && counts.today > 0 && <span className="ml-auto pl-2 text-xs text-gray-500">{counts.today}</span>}
              </button>
            ))}
            <p className="hidden px-2.5 pb-1 pt-3 text-xs font-semibold text-gray-500 md:block">분류</p>
            {sortedCats.map((c) => (
              <button key={c.id} type="button" aria-current={view === `cat:${c.id}` ? "page" : undefined} onClick={() => navigate({ view: `cat:${c.id}` })} className={navClass(view === `cat:${c.id}`)}>
                <span className="text-gray-400">#</span> {c.name}
                {(counts.byCat.get(c.id) ?? 0) > 0 && <span className="ml-auto pl-2 text-xs text-gray-500">{counts.byCat.get(c.id)}</span>}
              </button>
            ))}
          </nav>
        </div>
        <p className="mt-2 hidden px-1 text-[11px] leading-relaxed text-gray-400 md:block">
          빠른 입력: <b>내일 오후 2시</b> · <b>다음 주 월요일</b> · <b>p1</b> · <b>#분류</b>
          <br />
          단축키: Q 추가 · G→T 오늘 · G→U 다음 · G→C 캘린더
        </p>
      </aside>

      <section className="min-w-0 flex-1 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-6" aria-live="polite">
        {error && <p role="alert" className="mb-3 text-sm text-red-700">분류를 불러오지 못했습니다: {error}</p>}
        {quickOpen && (
          <div className="mb-5">
            <QuickAdd
              today={today}
              categories={categories}
              defaultDate={today}
              defaultCategoryId={currentCat?.id}
              autoFocus
              onCreated={onCreated}
              onCancel={() => setQuickOpen(false)}
            />
          </div>
        )}
        {view === "today" && <TodayView {...viewProps} />}
        {view === "upcoming" && <UpcomingView {...viewProps} />}
        {view === "calendar" && <CalendarView {...viewProps} />}
        {view === "all" && <TodoBoard key={reloadToken} />}
        {view.startsWith("cat:") && (currentCat ? <CategoryView {...viewProps} category={currentCat} /> : <p className="text-sm text-gray-500">분류를 불러오는 중…</p>)}
      </section>

      {taskId && (
        <TaskDetail
          key={taskId}
          id={taskId}
          today={today}
          categories={categories}
          onClose={() => navigate({ task: null })}
          onOpen={(id) => navigate({ task: id })}
          onChanged={(message, undo) => {
            reload();
            if (message) showToast(message, undo);
          }}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
