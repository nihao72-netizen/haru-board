"use client";

import { useEffect } from "react";
import type { EntryCategory, EntryWithSubtasks, Priority } from "@/lib/entries";
import { relativeDateLabel, timeLabel } from "@/lib/quick-parse";

export type Task = EntryWithSubtasks;
export type ListResult<T> = { items: T[]; page: number; limit: number; total: number };

/** 우선순위: 색 + 글자(색만으로 구분하지 않음) */
export const PRIORITY: Record<Priority, { label: string; ring: string; fill: string; text: string; flag: string }> = {
  1: { label: "P1", ring: "border-red-600", fill: "bg-red-50", text: "text-red-700", flag: "🚩" },
  2: { label: "P2", ring: "border-orange-500", fill: "bg-orange-50", text: "text-orange-700", flag: "🚩" },
  3: { label: "P3", ring: "border-blue-600", fill: "bg-blue-50", text: "text-blue-700", flag: "🚩" },
  4: { label: "P4", ring: "border-gray-400", fill: "bg-white", text: "text-gray-500", flag: "⚐" },
};

/** 날짜 칩 색: 지난 날 빨강 / 오늘 초록 / 내일 주황 / 이후 보라 */
export function dateTone(date: string, today: string) {
  if (date < today) return "text-red-700";
  if (date === today) return "text-green-700";
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date === tomorrow.toISOString().slice(0, 10)) return "text-orange-700";
  return "text-purple-700";
}

export function dateTimeLabel(date: string, time: string | null | undefined, today: string) {
  return `${relativeDateLabel(date, today)}${time ? ` ${timeLabel(time)}` : ""}`;
}

const seoulTime = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export const remindLabel = (iso: string) => seoulTime.format(new Date(iso));

/** 체크 원: 테두리 색 = 우선순위. 누르면 완료/완료 취소 */
export function CheckCircle(props: { priority: Priority; done: boolean; title: string; onToggle: () => void; disabled?: boolean; size?: "sm" | "md" }) {
  const p = PRIORITY[props.priority];
  const size = props.size === "sm" ? "h-4 w-4 text-[10px]" : "h-[18px] w-[18px] text-[11px]";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={props.done}
      aria-label={`${props.title} ${props.done ? "완료 취소" : "완료"} (우선순위 ${p.label})`}
      disabled={props.disabled}
      onClick={(e) => {
        e.stopPropagation();
        props.onToggle();
      }}
      className={`group mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2 ${size} ${p.ring} ${
        props.done ? "!border-success bg-success text-white" : `${p.fill} ${p.text}`
      } disabled:opacity-50`}
    >
      <span className={props.done ? "check-pop" : "opacity-0 group-hover:opacity-100"} aria-hidden="true">
        ✓
      </span>
    </button>
  );
}

/** 작업 행: 체크 원 + 제목 + 메타(날짜·시각·하위 작업·알림·분류) */
export function TaskRow(props: {
  task: Task;
  today: string;
  category?: EntryCategory;
  showDate?: boolean;
  onToggle: () => void;
  onOpen: () => void;
  busy?: boolean;
}) {
  const t = props.task;
  const done = !!t.is_completed;
  const p = PRIORITY[t.priority];
  const description = t.content?.split("\n").find((l) => l.trim());
  return (
    <li className="group/row border-b border-gray-100">
      <div
        role="button"
        tabIndex={0}
        onClick={props.onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) props.onOpen();
        }}
        className="flex min-h-[52px] cursor-pointer items-start gap-3 rounded-md px-1 py-2.5 hover:bg-gray-100 focus-visible:bg-gray-100"
      >
        <CheckCircle priority={t.priority} done={done} title={t.title} onToggle={props.onToggle} disabled={props.busy} />
        <div className="min-w-0 flex-1">
          <p className={`break-words text-sm ${done ? "text-gray-400 line-through" : "text-gray-900"}`}>{t.title}</p>
          {description && <p className="mt-0.5 truncate text-xs text-gray-500">{description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            {props.showDate && (
              <span className={dateTone(t.record_date, props.today)}>📅 {dateTimeLabel(t.record_date, t.scheduled_time, props.today)}</span>
            )}
            {!props.showDate && t.scheduled_time && <span className="text-gray-600">🕑 {timeLabel(t.scheduled_time)}</span>}
            {t.subtask_total > 0 && (
              <span title="하위 작업">
                ⑂ {t.subtask_completed}/{t.subtask_total}
              </span>
            )}
            {t.remind_at && <span title="미리 알림">⏰ {remindLabel(t.remind_at)}</span>}
            {t.priority < 4 && <span className={`font-semibold ${p.text}`}>{p.label}</span>}
            {t.due_date && <span title="마감일">마감 {relativeDateLabel(t.due_date, props.today)}</span>}
          </div>
        </div>
        {props.category && <span className="hidden shrink-0 text-xs text-gray-400 sm:inline"># {props.category.name}</span>}
      </div>
    </li>
  );
}

/** 왼쪽 아래 토스트 (+ 실행 취소) */
export type ToastState = { id: number; text: string; undo?: () => void } | null;
export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            onClose();
          }}
          className="font-semibold text-orange-300 hover:underline"
        >
          실행 취소
        </button>
      )}
      <button type="button" aria-label="닫기" onClick={onClose} className="text-gray-400 hover:text-white">
        ✕
      </button>
    </div>
  );
}

/** 날짜 그룹 헤더: 11월 3일 · 오늘 · 화요일 */
export function groupLabel(date: string, today: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  const rel = relativeDateLabel(date, today);
  const base = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return rel === "오늘" || rel === "내일" || rel === "어제" ? `${base} · ${rel} · ${w}요일` : `${base} · ${w}요일`;
}
