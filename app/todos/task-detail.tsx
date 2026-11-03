"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import type { Entry, EntryCategory, Priority } from "@/lib/entries";
import { computeRemindAt, QuickAdd, requestNotifyPermission } from "./quick-add";
import { CheckCircle, PRIORITY, remindLabel, TaskRow, type ListResult, type Task } from "./todo-shared";

const field = "mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

/** ISO → datetime-local 값 (서울 시각) */
function toSeoulLocal(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  return d.toISOString().slice(0, 16);
}

export function TaskDetail(props: {
  id: string;
  today: string;
  categories: EntryCategory[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onChanged: (message?: string, undo?: () => void) => void;
}) {
  const { id, today, categories } = props;
  const [task, setTask] = useState<Entry | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [parent, setParent] = useState<Entry | null>(null);
  const [token, setToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Entry>(`/api/entries/${id}`),
      api<ListResult<Task>>(`/api/entries?parent_id=${id}&sort=schedule&limit=500`),
    ])
      .then(async ([t, subs]) => {
        const p = t.parent_id ? await api<Entry>(`/api/entries/${t.parent_id}`).catch(() => null) : null;
        if (cancelled) return;
        setTask(t);
        setTitle(t.title);
        setContent(t.content ?? "");
        setSubtasks(subs.items.map((s) => ({ ...s, subtask_total: 0, subtask_completed: 0 })));
        setParent(p);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  async function save(patch: Record<string, unknown>, label = "저장했습니다") {
    try {
      const t = await api<Entry>(`/api/entries/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setTask(t);
      setSaved(label);
      setError(null);
      props.onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function toggle(entry: Entry | Task, isSelf: boolean) {
    const next = !entry.is_completed;
    await api(`/api/entries/${entry.id}`, { method: "PATCH", body: JSON.stringify({ is_completed: next }) }).catch((e) => setError(errorMessage(e)));
    if (isSelf) setTask((t) => (t ? { ...t, is_completed: next } : t));
    else setToken((x) => x + 1);
    props.onChanged(
      next ? "작업을 완료했습니다" : undefined,
      next
        ? async () => {
            await api(`/api/entries/${entry.id}`, { method: "PATCH", body: JSON.stringify({ is_completed: false }) });
            setToken((x) => x + 1);
            props.onChanged();
          }
        : undefined,
    );
  }

  async function remove() {
    if (!task) return;
    const n = subtasks.length;
    if (!window.confirm(`'${task.title}'을(를) 삭제할까요?${n ? ` 하위 작업 ${n}개도 함께 삭제됩니다.` : ""} 되돌릴 수 없습니다.`)) return;
    try {
      await api(`/api/entries/${id}`, { method: "DELETE" });
      props.onChanged("작업을 삭제했습니다");
      props.onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // 닫을 때 저장 안 된 제목·설명이 있으면 확인
  function close() {
    const dirty = task && (title.trim() !== task.title || (content || null) !== (task.content || null));
    if (dirty && !window.confirm("저장하지 않은 변경사항을 삭제하겠습니까?")) return;
    props.onClose();
  }

  const category = categories.find((c) => c.id === task?.category_id);
  const doneSubs = subtasks.filter((s) => s.is_completed).length;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-8" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="작업 상세"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-sm text-gray-500">
          <span>
            # {category?.name ?? "분류"}
            {parent && (
              <>
                {" "}
                ›{" "}
                <button type="button" className="hover:underline" onClick={() => props.onOpen(parent.id)}>
                  {parent.title}
                </button>
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-700">{saved}</span>}
            <button type="button" onClick={close} aria-label="닫기" className="rounded px-2 py-1 text-lg hover:bg-gray-100">
              ✕
            </button>
          </div>
        </div>

        {!task ? (
          <p className="p-6 text-sm text-gray-500">{error ? `불러오지 못했습니다: ${error}` : "불러오는 중…"}</p>
        ) : (
          <div className="grid md:grid-cols-[1fr_260px]">
            <div className="space-y-4 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                {task.type === "todo" && (
                  <CheckCircle priority={task.priority} done={!!task.is_completed} title={task.title} onToggle={() => void toggle(task, true)} />
                )}
                <input
                  aria-label="작업 이름"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title.trim() && title.trim() !== task.title && void save({ title })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur();
                  }}
                  className={`w-full rounded px-1 text-xl font-bold focus:bg-gray-50 focus:outline-none ${task.is_completed ? "text-gray-400 line-through" : ""}`}
                />
              </div>
              <textarea
                aria-label="설명"
                value={content}
                rows={4}
                placeholder="설명 (메모, 참고 내용)"
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => (content || null) !== (task.content || null) && void save({ content })}
                className="w-full rounded border border-transparent px-1 text-sm text-gray-700 hover:border-gray-200 focus:border-gray-300 focus:outline-none"
              />

              {task.type === "todo" && !task.parent_id && (
                <section aria-label="하위 작업">
                  <h3 className="text-sm font-semibold text-gray-700">
                    하위 작업 {subtasks.length > 0 && <span className="font-normal text-gray-500">{doneSubs}/{subtasks.length}</span>}
                  </h3>
                  <ul className="mt-1">
                    {subtasks.map((s) => (
                      <TaskRow key={s.id} task={s} today={today} showDate onToggle={() => void toggle(s, false)} onOpen={() => props.onOpen(s.id)} />
                    ))}
                  </ul>
                  {adding ? (
                    <div className="mt-2">
                      <QuickAdd
                        today={today}
                        categories={categories}
                        defaultDate={task.record_date}
                        defaultCategoryId={task.category_id}
                        parentId={task.id}
                        placeholder="하위 작업 (예: 자료 정리 내일 p2)"
                        autoFocus
                        onCreated={() => {
                          setToken((x) => x + 1);
                          props.onChanged();
                        }}
                        onCancel={() => setAdding(false)}
                      />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAdding(true)} className="mt-2 text-sm text-gray-500 hover:text-red-600">
                      ＋ 하위 작업 추가
                    </button>
                  )}
                </section>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>

            <aside className="space-y-3 rounded-br-xl bg-gray-50 p-4 text-sm md:rounded-tr-none" aria-label="속성">
              <label className="block text-xs font-semibold text-gray-500">
                분류
                <select className={field} value={task.category_id} onChange={(e) => void save({ category_id: e.target.value })}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      # {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                날짜
                <input type="date" className={field} value={task.record_date} onChange={(e) => e.target.value && void save({ record_date: e.target.value })} />
              </label>
              {task.type === "todo" && (
                <>
                  <label className="block text-xs font-semibold text-gray-500">
                    시각
                    <div className="flex gap-1">
                      <input
                        type="time"
                        className={field}
                        value={task.scheduled_time?.slice(0, 5) ?? ""}
                        onChange={(e) => void save({ scheduled_time: e.target.value || null })}
                      />
                      {task.scheduled_time && (
                        <button type="button" className="mt-1 rounded px-2 text-gray-500 hover:bg-gray-200" aria-label="시각 지우기" onClick={() => void save({ scheduled_time: null })}>
                          ✕
                        </button>
                      )}
                    </div>
                  </label>
                  <label className="block text-xs font-semibold text-gray-500">
                    우선순위
                    <select className={`${field} ${PRIORITY[task.priority].text}`} value={task.priority} onChange={(e) => void save({ priority: Number(e.target.value) as Priority })}>
                      {([1, 2, 3, 4] as Priority[]).map((n) => (
                        <option key={n} value={n}>
                          {PRIORITY[n].flag} 우선순위 {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs font-semibold text-gray-500">
                    미리 알림
                    {task.remind_at ? (
                      <div className="mt-1 flex items-center justify-between rounded border border-gray-200 bg-white px-2 py-1.5 text-sm font-normal text-gray-800">
                        ⏰ {remindLabel(task.remind_at)}
                        <button type="button" aria-label="알림 지우기" className="text-gray-400 hover:text-gray-700" onClick={() => void save({ remind_at: null })}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(["at", "10", "30", "60"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 hover:bg-gray-100"
                            onClick={() => {
                              requestNotifyPermission();
                              void save({ remind_at: computeRemindAt(task.record_date, task.scheduled_time?.slice(0, 5) ?? null, r, "") }, "알림을 설정했습니다");
                            }}
                          >
                            {r === "at" ? "정각" : r === "60" ? "1시간 전" : `${r}분 전`}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="datetime-local"
                      aria-label="알림 직접 지정"
                      className={field}
                      value={task.remind_at ? toSeoulLocal(task.remind_at) : ""}
                      onChange={(e) => {
                        if (!e.target.value) return void save({ remind_at: null });
                        requestNotifyPermission();
                        void save({ remind_at: new Date(`${e.target.value}:00+09:00`).toISOString() }, "알림을 설정했습니다");
                      }}
                    />
                    <p className="mt-1 font-normal text-gray-400">시각이 없으면 그날 오전 9시 기준. 화면이 열려 있을 때 알려 드립니다.</p>
                  </div>
                  <label className="block text-xs font-semibold text-gray-500">
                    마감일
                    <input type="date" className={field} value={task.due_date ?? ""} onChange={(e) => void save({ due_date: e.target.value || null })} />
                  </label>
                </>
              )}
              <button type="button" onClick={() => void remove()} className="w-full rounded border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                삭제
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
