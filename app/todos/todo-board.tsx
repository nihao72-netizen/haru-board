"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import { formatKoreanDate, todayKST } from "@/lib/date";
import type { Entry, EntryCategory, EntryType } from "@/lib/entries";

type ListResult = { items: Entry[]; page: number; limit: number; total: number };
type Filters = {
  type: "all" | EntryType;
  status: "all" | "incomplete" | "completed";
  date: string;
  category_id: string;
  search: string;
};
type Notice = { kind: "success" | "error"; text: string } | null;

const PAGE_SIZE = 20;
const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const buttonClass = "rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

function buildQuery(filters: Filters, page: number) {
  const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (filters.type !== "all") q.set("type", filters.type);
  if (filters.status !== "all") q.set("status", filters.status);
  if (filters.date) q.set("date", filters.date);
  if (filters.category_id) q.set("category_id", filters.category_id);
  if (filters.search.trim()) q.set("search", filters.search.trim());
  return q.toString();
}

export function TodoBoard() {
  const today = todayKST();
  const [categories, setCategories] = useState<EntryCategory[]>([]);
  const [filters, setFilters] = useState<Filters>({ type: "all", status: "all", date: "", category_id: "", search: "" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  // 마지막으로 응답을 받은 요청 키. 현재 키와 다르면 로딩 중으로 본다.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const requestKey = `${buildQuery(filters, page)}#${reloadToken}`;
  const loading = loadedKey !== requestKey;

  const reload = useCallback(() => {
    setPage(1);
    setReloadToken((t) => t + 1);
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await api<EntryCategory[]>("/api/entry-categories"));
    } catch (e) {
      setNotice({ kind: "error", text: `분류를 불러오지 못했습니다: ${errorMessage(e)}` });
    }
  }, []);

  useEffect(() => {
    // 마운트 시 분류 목록 로드
    let cancelled = false;
    api<EntryCategory[]>("/api/entry-categories")
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch((e) => {
        if (!cancelled) setNotice({ kind: "error", text: `분류를 불러오지 못했습니다: ${errorMessage(e)}` });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const [query] = requestKey.split("#");
    api<ListResult>(`/api/entries?${query}`)
      .then((result) => {
        if (cancelled) return;
        setItems((prev) => (result.page === 1 ? result.items : [...prev, ...result.items]));
        setTotal(result.total);
        setListError(null);
      })
      .catch((e) => {
        if (!cancelled) setListError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  function updateFilters(next: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  }

  async function toggleComplete(entry: Entry) {
    try {
      const updated = await api<Entry>(`/api/entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_completed: !entry.is_completed }),
      });
      setItems((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      if (filters.status !== "all") reload();
    } catch (e) {
      setNotice({ kind: "error", text: `완료 상태를 바꾸지 못했습니다: ${errorMessage(e)}` });
    }
  }

  async function remove(entry: Entry) {
    if (!window.confirm(`'${entry.title}'을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await api(`/api/entries/${entry.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((e) => e.id !== entry.id));
      setTotal((t) => Math.max(0, t - 1));
      setNotice({ kind: "success", text: "삭제했습니다." });
    } catch (e) {
      setNotice({ kind: "error", text: `삭제하지 못했습니다: ${errorMessage(e)}` });
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded border px-4 py-3 text-sm ${
            notice.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs underline">
            닫기
          </button>
        </div>
      )}

      <EntryForm
        mode="create"
        categories={categories}
        defaultDate={today}
        onDone={(msg) => {
          setNotice({ kind: "success", text: msg });
          reload();
        }}
        onError={(msg) => setNotice({ kind: "error", text: msg })}
      />

      <CategoryManager
        categories={categories}
        onChanged={loadCategories}
        onNotice={setNotice}
      />

      {/* 필터 */}
      <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-label="목록 필터">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="유형">
          {(
            [
              ["all", "전체"],
              ["todo", "할 일"],
              ["memo", "메모"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filters.type === value}
              onClick={() => updateFilters({ type: value, status: value === "memo" ? "all" : filters.status })}
              className={`${buttonClass} ${filters.type === value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-gray-700">
            완료 상태
            <select
              className={`${inputClass} mt-1`}
              value={filters.status}
              disabled={filters.type === "memo"}
              onChange={(e) => updateFilters({ status: e.target.value as Filters["status"] })}
            >
              <option value="all">전체</option>
              <option value="incomplete">미완료</option>
              <option value="completed">완료</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            분류
            <select
              className={`${inputClass} mt-1`}
              value={filters.category_id}
              onChange={(e) => updateFilters({ category_id: e.target.value })}
            >
              <option value="">전체</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            기록 날짜
            <div className="mt-1 flex gap-1">
              <input
                type="date"
                className={inputClass}
                value={filters.date}
                onChange={(e) => updateFilters({ date: e.target.value })}
              />
              {filters.date && (
                <button
                  type="button"
                  className={`${buttonClass} bg-gray-100 text-gray-700 hover:bg-gray-200`}
                  onClick={() => updateFilters({ date: "" })}
                >
                  해제
                </button>
              )}
            </div>
          </label>
          <form
            className="text-sm text-gray-700"
            onSubmit={(e) => {
              e.preventDefault();
              updateFilters({ search: searchInput });
            }}
          >
            <label htmlFor="entry-search">검색 (제목·내용)</label>
            <div className="mt-1 flex gap-1">
              <input
                id="entry-search"
                type="search"
                className={inputClass}
                value={searchInput}
                maxLength={100}
                placeholder="검색어"
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button type="submit" className={`${buttonClass} bg-gray-800 text-white hover:bg-gray-900`}>
                검색
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 목록 */}
      <section aria-label="기록 목록" aria-busy={loading}>
        <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
          <span>총 {total}건</span>
          {(filters.type !== "all" || filters.status !== "all" || filters.date || filters.category_id || filters.search) && (
            <button
              type="button"
              className="underline"
              onClick={() => {
                setSearchInput("");
                updateFilters({ type: "all", status: "all", date: "", category_id: "", search: "" });
              }}
            >
              필터 초기화
            </button>
          )}
        </div>

        {listError ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            목록을 불러오지 못했습니다: {listError}
            <button type="button" className="ml-2 underline" onClick={reload}>
              다시 시도
            </button>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg bg-white p-6 text-sm text-gray-500 shadow">
            {filters.search || filters.date || filters.category_id || filters.status !== "all" || filters.type !== "all"
              ? "조건에 맞는 기록이 없습니다."
              : "아직 기록이 없습니다. 위에서 첫 할 일이나 메모를 추가해 보세요."}
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((entry) => (
              <EntryItem
                key={entry.id}
                entry={entry}
                today={today}
                categoryName={categoryName.get(entry.category_id) ?? "(삭제된 분류)"}
                categories={categories}
                onToggle={() => toggleComplete(entry)}
                onDelete={() => remove(entry)}
                onSaved={(updated) => {
                  setItems((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
                  setNotice({ kind: "success", text: "수정했습니다." });
                }}
                onError={(msg) => setNotice({ kind: "error", text: msg })}
              />
            ))}
          </ul>
        )}

        {!listError && items.length < total && (
          <div className="mt-4 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => setPage((p) => p + 1)}
              className={`${buttonClass} bg-white text-gray-800 shadow hover:bg-gray-50`}
            >
              {loading ? "불러오는 중…" : `더 보기 (${items.length}/${total})`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function EntryItem(props: {
  entry: Entry;
  today: string;
  categoryName: string;
  categories: EntryCategory[];
  onToggle: () => void;
  onDelete: () => void;
  onSaved: (e: Entry) => void;
  onError: (msg: string) => void;
}) {
  const { entry, today } = props;
  const [editing, setEditing] = useState(false);
  const overdue = entry.type === "todo" && !entry.is_completed && entry.due_date !== null && entry.due_date < today;

  if (editing) {
    return (
      <li>
        <EntryForm
          mode="edit"
          entry={entry}
          categories={props.categories}
          defaultDate={entry.record_date}
          onDone={() => setEditing(false)}
          onSaved={(updated) => {
            props.onSaved(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onError={props.onError}
        />
      </li>
    );
  }

  return (
    <li className="rounded-lg bg-white p-4 shadow">
      <div className="flex items-start gap-3">
        {entry.type === "todo" ? (
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
            checked={entry.is_completed === true}
            onChange={props.onToggle}
            aria-label={`${entry.title} ${entry.is_completed ? "완료 취소" : "완료"}`}
          />
        ) : (
          <span className="mt-0.5 shrink-0 rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">메모</span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`break-words font-medium ${entry.is_completed ? "text-gray-400 line-through" : "text-gray-900"}`}>
            {entry.title}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{props.categoryName}</span>
            <span>기록 {formatKoreanDate(entry.record_date)}</span>
            {entry.due_date && (
              <span className={overdue ? "font-semibold text-red-700" : ""}>
                마감 {formatKoreanDate(entry.due_date)}
                {overdue && " · 마감 지남"}
              </span>
            )}
            {entry.type === "todo" && <span>{entry.is_completed ? "완료" : "미완료"}</span>}
          </div>
          {entry.content && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{entry.content}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <button type="button" onClick={() => setEditing(true)} className="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">
            수정
          </button>
          <button type="button" onClick={props.onDelete} className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50">
            삭제
          </button>
        </div>
      </div>
    </li>
  );
}

function EntryForm(props: {
  mode: "create" | "edit";
  entry?: Entry;
  categories: EntryCategory[];
  defaultDate: string;
  onDone: (msg: string) => void;
  onSaved?: (e: Entry) => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { entry, categories } = props;
  const [type, setType] = useState<EntryType>(entry?.type ?? "todo");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [categoryId, setCategoryId] = useState(entry?.category_id ?? "");
  const [recordDate, setRecordDate] = useState(entry?.record_date ?? props.defaultDate);
  const [dueDate, setDueDate] = useState(entry?.due_date ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 분류를 고르지 않았으면 첫 분류를 기본값으로 사용
  const effectiveCategory = categoryId || categories[0]?.id || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setFieldError("제목을 입력해 주세요.");
    if (title.trim().length > 200) return setFieldError("제목은 200자 이하로 입력해 주세요.");
    if (!effectiveCategory) return setFieldError("분류를 먼저 추가해 주세요.");
    if (!recordDate) return setFieldError("기록 날짜를 선택해 주세요.");
    setFieldError(null);
    setSaving(true);
    const body = {
      type,
      title,
      category_id: effectiveCategory,
      record_date: recordDate,
      due_date: type === "todo" && dueDate ? dueDate : null,
      content,
    };
    try {
      if (props.mode === "create") {
        await api<Entry>("/api/entries", { method: "POST", body: JSON.stringify(body) });
        setTitle("");
        setContent("");
        setDueDate("");
        props.onDone(type === "todo" ? "할 일을 추가했습니다." : "메모를 추가했습니다.");
      } else if (entry) {
        const updated = await api<Entry>(`/api/entries/${entry.id}`, { method: "PATCH", body: JSON.stringify(body) });
        props.onSaved?.(updated);
      }
    } catch (err) {
      props.onError(`저장하지 못했습니다: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const idp = props.mode === "create" ? "new" : entry?.id;

  return (
    <form onSubmit={submit} className="rounded-lg bg-white p-4 shadow sm:p-6" noValidate>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{props.mode === "create" ? "새 기록" : "기록 수정"}</h2>
        <div className="flex gap-1" role="radiogroup" aria-label="기록 유형">
          {(["todo", "memo"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`${buttonClass} py-1 ${type === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              {t === "todo" ? "할 일" : "메모"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-gray-700 sm:col-span-2" htmlFor={`title-${idp}`}>
          제목 <span className="text-red-600">*</span>
          <input
            id={`title-${idp}`}
            className={`${inputClass} mt-1`}
            value={title}
            maxLength={200}
            placeholder={type === "todo" ? "할 일을 입력하세요" : "메모 제목을 입력하세요"}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="text-sm text-gray-700">
          분류 <span className="text-red-600">*</span>
          <select className={`${inputClass} mt-1`} value={effectiveCategory} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.length === 0 && <option value="">분류 없음</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          기록 날짜 <span className="text-red-600">*</span>
          <input type="date" className={`${inputClass} mt-1`} value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
        </label>
        {type === "todo" && (
          <label className="text-sm text-gray-700">
            마감일 (선택)
            <input type="date" className={`${inputClass} mt-1`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        )}
        <label className="text-sm text-gray-700 sm:col-span-2">
          상세 내용 (선택)
          <textarea className={`${inputClass} mt-1`} rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
        </label>
      </div>

      {fieldError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {fieldError}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
          {saving ? "저장 중…" : props.mode === "create" ? "추가하기" : "저장"}
        </button>
        {props.onCancel && (
          <button type="button" onClick={props.onCancel} className={`${buttonClass} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}

function CategoryManager(props: {
  categories: EntryCategory[];
  onChanged: () => Promise<void>;
  onNotice: (n: Notice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      await props.onChanged();
      props.onNotice({ kind: "success", text: success });
      return true;
    } catch (e) {
      props.onNotice({ kind: "error", text: errorMessage(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-lg font-bold"
      >
        분류 관리 <span className="text-sm font-normal text-gray-500">{open ? "접기 ▲" : `${props.categories.length}개 · 펼치기 ▼`}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newName.trim()) return props.onNotice({ kind: "error", text: "분류 이름을 입력해 주세요." });
              const ok = await run(
                () => api("/api/entry-categories", { method: "POST", body: JSON.stringify({ name: newName }) }),
                "분류를 추가했습니다.",
              );
              if (ok) setNewName("");
            }}
          >
            <input
              className={inputClass}
              value={newName}
              maxLength={50}
              placeholder="새 분류 이름"
              aria-label="새 분류 이름"
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" disabled={busy} className={`${buttonClass} shrink-0 bg-gray-800 text-white hover:bg-gray-900`}>
              추가
            </button>
          </form>
          <ul className="divide-y divide-gray-100">
            {props.categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                {editingId === c.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await run(
                        () => api(`/api/entry-categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ name: editName }) }),
                        "분류 이름을 바꿨습니다.",
                      );
                      if (ok) setEditingId(null);
                    }}
                  >
                    <input
                      className={inputClass}
                      value={editName}
                      maxLength={50}
                      aria-label="분류 이름"
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <button type="submit" disabled={busy} className={`${buttonClass} shrink-0 bg-blue-600 text-white`}>
                      저장
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={`${buttonClass} shrink-0 bg-gray-100`}>
                      취소
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{c.name}</span>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                      }}
                    >
                      이름 변경
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (!window.confirm(`'${c.name}' 분류를 삭제할까요?`)) return;
                        void run(() => api(`/api/entry-categories/${c.id}`, { method: "DELETE" }), "분류를 삭제했습니다.");
                      }}
                    >
                      삭제
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">기록이 사용 중인 분류는 삭제할 수 없습니다.</p>
        </div>
      )}
    </section>
  );
}
