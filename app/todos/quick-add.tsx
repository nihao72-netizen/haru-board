"use client";

import { useMemo, useRef, useState } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/api/client";
import { addDays } from "@/lib/date";
import type { Entry, EntryCategory, Priority } from "@/lib/entries";
import { parseQuickAdd, timeLabel, type TokenKind } from "@/lib/quick-parse";
import { dateTimeLabel, dateTone, PRIORITY } from "./todo-shared";

type Remind = "none" | "at" | "10" | "30" | "60" | "custom";
const REMIND_LABEL: Record<Exclude<Remind, "none" | "custom">, string> = { at: "정각", "10": "10분 전", "30": "30분 전", "60": "1시간 전" };
const HIGHLIGHT: Record<TokenKind, string> = {
  date: "bg-orange-100",
  time: "bg-orange-100",
  priority: "bg-red-100",
  category: "bg-blue-100",
};

/** 날짜·시각(서울)과 알림 설정 → remind_at ISO. 시각이 없으면 그날 오전 9시 기준 */
export function computeRemindAt(date: string, time: string | null, remind: Remind, custom: string): string | null {
  if (remind === "none") return null;
  if (remind === "custom") return custom ? new Date(`${custom}:00+09:00`).toISOString() : null;
  const base = new Date(`${date}T${time ?? "09:00"}:00+09:00`);
  const minutes = remind === "at" ? 0 : Number(remind);
  return new Date(base.getTime() - minutes * 60000).toISOString();
}

export function requestNotifyPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
}

/** 이름으로 분류 찾기, 없으면 만들기 (중복이면 다시 조회) */
async function ensureCategory(name: string, categories: EntryCategory[]) {
  const found = categories.find((c) => c.name === name);
  if (found) return { id: found.id, created: false };
  try {
    const c = await api<EntryCategory>("/api/entry-categories", { method: "POST", body: JSON.stringify({ name }) });
    return { id: c.id, created: true };
  } catch (e) {
    if (e instanceof ClientApiError && e.status === 409) {
      const list = await api<EntryCategory[]>("/api/entry-categories");
      const f = list.find((c) => c.name === name);
      if (f) return { id: f.id, created: false };
    }
    throw e;
  }
}

export function QuickAdd(props: {
  today: string;
  categories: EntryCategory[];
  defaultDate: string;
  defaultCategoryId?: string;
  parentId?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCreated: (entry: Entry, createdCategory: boolean) => void;
  onCancel?: () => void;
}) {
  const { today, categories } = props;
  const [text, setText] = useState("");
  const [parseText, setParseText] = useState(""); // 한글 조합이 끝난 글자만 해석
  const composing = useRef(false);
  const [disabled, setDisabled] = useState<Set<TokenKind>>(new Set());
  const [ov, setOv] = useState<{ date?: string; time?: string | null; priority?: Priority; categoryId?: string }>({});
  const [remind, setRemind] = useState<Remind>("none");
  const [customRemind, setCustomRemind] = useState("");
  const [pop, setPop] = useState<null | "date" | "priority" | "category" | "remind">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseQuickAdd(parseText, today, disabled), [parseText, today, disabled]);
  const date = ov.date ?? parsed.date ?? props.defaultDate;
  const time = ov.time !== undefined ? ov.time : (parsed.time ?? null);
  const priority: Priority = ov.priority ?? parsed.priority ?? 4;
  const defaultCat = props.defaultCategoryId ?? categories.find((c) => c.name === "일상")?.id ?? categories[0]?.id;
  const parsedCat = parsed.category ? categories.find((c) => c.name === parsed.category) : undefined;
  const newCategoryName = !ov.categoryId && parsed.category && !parsedCat ? parsed.category : null;
  const categoryId = ov.categoryId ?? parsedCat?.id ?? defaultCat;
  const categoryName = newCategoryName ?? categories.find((c) => c.id === categoryId)?.name ?? "분류";
  const title = text === parseText ? parsed.title : text.trim();

  function update(v: string) {
    setText(v);
    setError(null);
    if (!composing.current) setParseText(v);
  }

  /** 칩의 ×: 글자에서 인식한 것이면 인식 취소(글자로 되돌림), 직접 고른 것이면 선택 취소 */
  function clear(kind: TokenKind) {
    setOv((o) => {
      const n = { ...o };
      if (kind === "date") delete n.date;
      if (kind === "time") delete n.time;
      if (kind === "priority") delete n.priority;
      if (kind === "category") delete n.categoryId;
      return n;
    });
    // 직접 고른 값이 없을 때만 글자 인식을 끈다 (직접 고른 값은 위에서 지워져 글자 인식 값으로 돌아감)
    const hasOverride =
      (kind === "date" && ov.date !== undefined) ||
      (kind === "time" && ov.time !== undefined) ||
      (kind === "priority" && ov.priority !== undefined) ||
      (kind === "category" && ov.categoryId !== undefined);
    if (!hasOverride && parsed.spans.some((s) => s.kind === kind)) setDisabled((d) => new Set(d).add(kind));
  }

  async function submit() {
    if (composing.current || busy) return;
    if (!title) return setError("할 일 이름을 입력해 주세요.");
    if (!categoryId && !newCategoryName) return setError("분류가 없습니다. 분류를 먼저 만들어 주세요.");
    setBusy(true);
    try {
      const cat = newCategoryName ? await ensureCategory(newCategoryName, categories) : { id: categoryId!, created: false };
      const body = {
        type: "todo",
        category_id: cat.id,
        record_date: date,
        scheduled_time: time,
        priority,
        title,
        remind_at: computeRemindAt(date, time, remind, customRemind),
        parent_id: props.parentId ?? null,
      };
      const entry = await api<Entry>("/api/entries", { method: "POST", body: JSON.stringify(body) });
      // 연속 입력: 입력창은 열어 둔 채 비움
      setText("");
      setParseText("");
      setDisabled(new Set());
      setOv({});
      setRemind("none");
      setCustomRemind("");
      setPop(null);
      props.onCreated(entry, cat.created);
      inputRef.current?.focus();
    } catch (e) {
      setError(`추가하지 못했습니다: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // 입력창 뒤에 같은 글자를 깔고 인식한 부분만 색칠 (입력창 글자는 그대로 보임)
  const highlighted = useMemo(() => {
    if (text !== parseText || parsed.spans.length === 0) return null;
    const out: React.ReactNode[] = [];
    let pos = 0;
    parsed.spans.forEach((s, i) => {
      out.push(text.slice(pos, s.start));
      out.push(
        <mark key={i} className={`rounded ${HIGHLIGHT[s.kind]} text-transparent`}>
          {text.slice(s.start, s.end)}
        </mark>,
      );
      pos = s.end;
    });
    out.push(text.slice(pos));
    return out;
  }, [text, parseText, parsed.spans]);

  const chip = "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs hover:bg-gray-50";
  const p = PRIORITY[priority];

  return (
    <div className="relative rounded-xl border border-gray-300 bg-white p-3 shadow-sm focus-within:border-gray-400">
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-1 py-1 text-sm text-transparent">
          {highlighted}
        </div>
        <input
          ref={inputRef}
          autoFocus={props.autoFocus}
          value={text}
          maxLength={200}
          aria-label={props.parentId ? "하위 작업 입력" : "할 일 입력"}
          placeholder={props.placeholder ?? "무엇을 해야 하나요? (예: 내일 오후 4시 수학 숙제 p2 #공부)"}
          onChange={(e) => update(e.target.value)}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={(e) => {
            composing.current = false;
            setParseText(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || composing.current) return; // 한글 조합 중 Enter 제출 금지
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              props.onCancel?.();
            }
          }}
          className="relative w-full bg-transparent px-1 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`${chip} gap-0 p-0 ${dateTone(date, today)}`}>
          <button type="button" className="px-2 py-1" onClick={() => setPop(pop === "date" ? null : "date")}>
            📅 {dateTimeLabel(date, time, today)}
          </button>
          {(ov.date || parsed.date || time) && (
            <button
              type="button"
              aria-label={time ? "시각 취소" : "날짜 인식 취소"}
              className="py-1 pr-2 text-gray-400 hover:text-gray-700"
              onClick={() => (time ? clear("time") : clear("date"))}
            >
              ✕
            </button>
          )}
        </span>
        <button type="button" className={`${chip} ${priority < 4 ? p.text : "text-gray-600"}`} onClick={() => setPop(pop === "priority" ? null : "priority")}>
          {p.flag} {priority < 4 ? `우선순위 ${p.label}` : "우선순위"}
        </button>
        <button type="button" className={`${chip} text-gray-700`} onClick={() => setPop(pop === "category" ? null : "category")}>
          # {categoryName}
          {newCategoryName && <span className="text-[10px] text-blue-700">(새 분류)</span>}
        </button>
        <button type="button" className={`${chip} ${remind !== "none" ? "text-blue-700" : "text-gray-600"}`} onClick={() => setPop(pop === "remind" ? null : "remind")}>
          ⏰ {remind === "none" ? "미리 알림" : remind === "custom" ? "알림 직접 지정" : `알림 ${REMIND_LABEL[remind]}`}
        </button>
        <div className="ml-auto flex items-center gap-1">
          {props.onCancel && (
            <button type="button" onClick={props.onCancel} className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label="취소">
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !title}
            aria-label="추가"
            className="rounded-md bg-blue-600 px-3 py-1 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {busy ? "…" : "↑"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {pop && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setPop(null)} aria-hidden="true" />
          <div className="absolute left-3 top-full z-40 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-lg">
            {pop === "date" && (
              <div className="space-y-1">
                {[
                  ["오늘", today],
                  ["내일", addDays(today, 1)],
                  ["다음 주 월요일", addDays(today, ((8 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7) || 7)],
                ].map(([label, d]) => (
                  <button key={label} type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-gray-100" onClick={() => { setOv((o) => ({ ...o, date: d })); setPop(null); }}>
                    {label} <span className="text-xs text-gray-400">{d}</span>
                  </button>
                ))}
                <label className="block px-2 pt-1 text-xs text-gray-500">
                  날짜
                  <input type="date" value={date} onChange={(e) => e.target.value && setOv((o) => ({ ...o, date: e.target.value }))} className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                </label>
                <label className="block px-2 text-xs text-gray-500">
                  시각 {time && <span className="text-gray-700">({timeLabel(time)})</span>}
                  <input type="time" value={time ?? ""} onChange={(e) => setOv((o) => ({ ...o, time: e.target.value || null }))} className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                </label>
              </div>
            )}
            {pop === "priority" &&
              ([1, 2, 3, 4] as Priority[]).map((n) => (
                <button key={n} type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-gray-100 ${PRIORITY[n].text}`} onClick={() => { setOv((o) => ({ ...o, priority: n })); setPop(null); }}>
                  {PRIORITY[n].flag} 우선순위 {n}
                  {n === priority && " ✓"}
                </button>
              ))}
            {pop === "category" &&
              categories.map((c) => (
                <button key={c.id} type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-gray-100" onClick={() => { setOv((o) => ({ ...o, categoryId: c.id })); setPop(null); }}>
                  # {c.name}
                  {c.id === categoryId && !newCategoryName && " ✓"}
                </button>
              ))}
            {pop === "remind" && (
              <div className="space-y-1">
                {(["none", "at", "10", "30", "60"] as Remind[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="block w-full rounded px-2 py-1 text-left hover:bg-gray-100"
                    onClick={() => {
                      setRemind(r);
                      if (r !== "none") requestNotifyPermission();
                      setPop(null);
                    }}
                  >
                    {r === "none" ? "알림 없음" : `${time ? "작업 시각" : "오전 9시"} ${REMIND_LABEL[r as Exclude<Remind, "none" | "custom">]}`}
                    {r === remind && " ✓"}
                  </button>
                ))}
                <label className="block px-2 pt-1 text-xs text-gray-500">
                  직접 지정
                  <input
                    type="datetime-local"
                    value={customRemind}
                    onChange={(e) => {
                      setCustomRemind(e.target.value);
                      setRemind(e.target.value ? "custom" : "none");
                      if (e.target.value) requestNotifyPermission();
                    }}
                    className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <p className="px-2 text-[11px] text-gray-400">알림은 하루정리 화면이 열려 있을 때 표시됩니다.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
