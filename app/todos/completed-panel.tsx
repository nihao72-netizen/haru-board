"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import type { EntryCategory } from "@/lib/entries";
import { timeLabel } from "@/lib/quick-parse";
import { CheckCircle, groupLabel, type ListResult, type Task } from "./todo-shared";

const PAGE = 30;

/**
 * 오른쪽 '완료한 일' 패널: 완료한 할 일을 날짜(할 일의 날짜)별로 최근 날짜부터 보여 준다.
 * 체크를 누르면 완료 취소, 제목을 누르면 상세 보기.
 */
export function CompletedPanel(props: {
  today: string;
  categories: EntryCategory[];
  reloadToken: number;
  onToggle: (task: Task) => void;
  onOpen: (id: string) => void;
}) {
  const [pages, setPages] = useState(1);
  const [state, setState] = useState<{ key: string; items: Task[]; total: number; error: string | null } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const key = `${props.reloadToken}#${pages}`;

  useEffect(() => {
    let cancelled = false;
    const n = Number(key.split("#")[1]);
    api<ListResult<Task>>(`/api/entries?type=todo&status=completed&top_level=true&from=2000-01-01&with_subtasks=true&limit=${Math.min(500, PAGE * n)}`)
      .then((r) => !cancelled && setState({ key, items: r.items, total: r.total, error: null }))
      .catch((e) => !cancelled && setState((prev) => ({ key, items: prev?.items ?? [], total: prev?.total ?? 0, error: errorMessage(e) })));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const cats = useMemo(() => new Map(props.categories.map((c) => [c.id, c.name])), [props.categories]);
  const groups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of state?.items ?? []) m.set(t.record_date, [...(m.get(t.record_date) ?? []), t]);
    return [...m.entries()];
  }, [state?.items]);

  const items = state?.items ?? [];
  return (
    <aside
      aria-labelledby="completed-title"
      className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:w-72 xl:shrink-0 xl:overflow-y-auto"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="completed-title" className="text-base font-bold text-gray-800">
          <span className="text-green-700">✓</span> 완료한 일
          {state && <span className="ml-2 text-xs font-normal text-gray-500">{state.total}개</span>}
        </h2>
        <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)} className="text-xs text-gray-500 hover:underline xl:hidden">
          {collapsed ? "펼치기 ▼" : "접기 ▲"}
        </button>
      </div>
      <p className="mt-0.5 text-[11px] text-gray-400">할 일의 날짜별 · 최근 날짜부터</p>

      {!collapsed && (
        <>
          {state?.error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              불러오지 못했습니다: {state.error}
            </p>
          )}
          {!state ? (
            <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">아직 완료한 일이 없습니다.</p>
          ) : (
            <div className="mt-2">
              {groups.map(([date, list]) => (
                <section key={date} className="mt-3" aria-label={`${groupLabel(date, props.today)} 완료`}>
                  <h3 className="flex items-baseline justify-between border-b border-gray-100 pb-1 text-xs font-semibold text-gray-600">
                    {groupLabel(date, props.today)}
                    <span className="font-normal text-gray-400">{list.length}</span>
                  </h3>
                  <ul>
                    {list.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 py-1.5">
                        <CheckCircle priority={t.priority} done title={t.title} size="sm" onToggle={() => props.onToggle(t)} />
                        <button type="button" onClick={() => props.onOpen(t.id)} className="min-w-0 flex-1 text-left">
                          <span className="block break-words text-sm text-gray-500 line-through decoration-gray-300 hover:text-gray-800">{t.title}</span>
                          <span className="block text-[11px] text-gray-400">
                            {t.scheduled_time && `${timeLabel(t.scheduled_time)} · `}# {cats.get(t.category_id) ?? "분류 없음"}
                            {t.subtask_total > 0 && ` · ⑂ ${t.subtask_completed}/${t.subtask_total}`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {items.length < state.total && items.length < 500 && (
                <button type="button" onClick={() => setPages((p) => p + 1)} className="mt-3 text-sm text-gray-600 hover:underline">
                  더 보기 ({state.total - items.length}개 더)
                </button>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
