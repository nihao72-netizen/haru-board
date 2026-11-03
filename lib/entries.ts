import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, dbError } from "@/lib/api/http";
import { isDateString, optionalText, requireDate, requireText, requireUuid } from "@/lib/validate";

export type EntryType = "todo" | "memo";
export type Priority = 1 | 2 | 3 | 4;

export type Entry = {
  id: string;
  category_id: string;
  type: EntryType;
  /** 할 일을 하는 날 (화면의 '날짜') */
  record_date: string;
  /** 할 일 날짜의 시각 HH:MM:SS (없으면 날짜만) */
  scheduled_time: string | null;
  due_date: string | null;
  title: string;
  /** 메모 내용 / 할 일 설명 */
  content: string | null;
  is_completed: boolean | null;
  /** 1(가장 높음) ~ 4(기본) */
  priority: Priority;
  remind_at: string | null;
  /** 하위 작업이면 부모 할 일 id */
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

/** 목록 응답에서 with_subtasks=true일 때 붙는 하위 작업 집계 */
export type EntryWithSubtasks = Entry & { subtask_total: number; subtask_completed: number };

export type EntryCategory = { id: string; name: string; created_at: string };

export const ENTRY_COLUMNS =
  "id, category_id, type, record_date, scheduled_time, due_date, title, content, is_completed, priority, remind_at, parent_id, created_at, updated_at";

function parseTime(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v)) {
    throw new ApiError(400, "VALIDATION_ERROR", "시각은 HH:MM 형식이어야 합니다.");
  }
  return v.length === 5 ? `${v}:00` : v;
}

function parsePriority(v: unknown): Priority {
  if (v === 1 || v === 2 || v === 3 || v === 4) return v;
  throw new ApiError(400, "VALIDATION_ERROR", "우선순위는 1~4 중 하나여야 합니다.");
}

function parseRemindAt(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  // 시간대가 포함된 ISO 8601만 허용 (예: 2026-11-04T05:00:00Z, 2026-11-04T14:00:00+09:00)
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ApiError(400, "VALIDATION_ERROR", "알림 시각은 시간대가 포함된 ISO 형식이어야 합니다.");
  }
  return new Date(v).toISOString();
}

function parseParent(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return requireUuid(v, "상위 작업");
}

function parseType(v: unknown): EntryType {
  if (v !== "todo" && v !== "memo") {
    throw new ApiError(400, "VALIDATION_ERROR", "type은 todo 또는 memo여야 합니다.");
  }
  return v;
}

function parseDueDate(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (!isDateString(v)) throw new ApiError(400, "VALIDATION_ERROR", "마감일은 YYYY-MM-DD 형식이어야 합니다.");
  return v;
}

/** POST /api/entries 본문 검증 (user_id는 받지 않음 — 서버/DB가 결정) */
export function parseEntryCreate(body: Record<string, unknown>) {
  const type = parseType(body.type);
  const isCompleted =
    type === "memo" ? null : body.is_completed === undefined || body.is_completed === null ? false : body.is_completed;
  if (type === "todo" && typeof isCompleted !== "boolean") {
    throw new ApiError(400, "VALIDATION_ERROR", "is_completed는 true 또는 false여야 합니다.");
  }
  const parentId = parseParent(body.parent_id);
  if (parentId && type !== "todo") throw new ApiError(400, "VALIDATION_ERROR", "하위 작업은 할 일만 만들 수 있습니다.");
  return {
    type,
    category_id: requireUuid(body.category_id, "분류"),
    record_date: requireDate(body.record_date, "기록 날짜"),
    scheduled_time: parseTime(body.scheduled_time),
    due_date: parseDueDate(body.due_date),
    title: requireText(body.title, "제목", 200),
    content: optionalText(body.content, "내용"),
    is_completed: isCompleted as boolean | null,
    priority: body.priority === undefined || body.priority === null ? 4 : parsePriority(body.priority),
    remind_at: parseRemindAt(body.remind_at),
    parent_id: parentId,
  };
}

/**
 * PATCH /api/entries/{id} 본문 검증. 보낸 필드만 수정.
 * 유형 변경 규칙(PRD 4.2): memo → is_completed NULL, todo + 값 없음 → false (DB 트리거도 동일하게 보정)
 */
export function parseEntryUpdate(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if ("type" in body) patch.type = parseType(body.type);
  if ("category_id" in body) patch.category_id = requireUuid(body.category_id, "분류");
  if ("record_date" in body) patch.record_date = requireDate(body.record_date, "기록 날짜");
  if ("due_date" in body) patch.due_date = parseDueDate(body.due_date);
  if ("title" in body) patch.title = requireText(body.title, "제목", 200);
  if ("content" in body) patch.content = optionalText(body.content, "내용");
  if ("scheduled_time" in body) patch.scheduled_time = parseTime(body.scheduled_time);
  if ("priority" in body) patch.priority = parsePriority(body.priority);
  if ("remind_at" in body) patch.remind_at = parseRemindAt(body.remind_at);
  if ("parent_id" in body) patch.parent_id = parseParent(body.parent_id);
  if ("is_completed" in body) {
    if (body.is_completed !== null && typeof body.is_completed !== "boolean") {
      throw new ApiError(400, "VALIDATION_ERROR", "is_completed는 true 또는 false여야 합니다.");
    }
    patch.is_completed = body.is_completed;
  }
  if (Object.keys(patch).length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "수정할 항목이 없습니다.");
  }
  return patch;
}

/**
 * 하위 작업 규칙 (API 단계): 부모는 내 할 일이고 그 자신은 하위 작업이 아니어야 함(한 단계만).
 * selfId가 있으면(수정) 자기 자신·하위 작업을 가진 할 일은 다른 할 일의 하위로 옮길 수 없음.
 * 같은 사용자 소유는 DB 복합 FK가 최종 보장한다.
 */
export async function checkParent(supabase: SupabaseClient, parentId: string, selfId?: string) {
  if (selfId && parentId === selfId) throw new ApiError(400, "VALIDATION_ERROR", "자기 자신을 상위 작업으로 지정할 수 없습니다.");
  const { data, error } = await supabase.from("entries").select("id, type, parent_id").eq("id", parentId).maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(400, "INVALID_REFERENCE", "상위 작업을 찾을 수 없습니다.");
  if (data.type !== "todo") throw new ApiError(400, "VALIDATION_ERROR", "메모 아래에는 하위 작업을 만들 수 없습니다.");
  if (data.parent_id) throw new ApiError(400, "VALIDATION_ERROR", "하위 작업 아래에 다시 하위 작업을 만들 수 없습니다.");
  if (selfId) {
    const { count, error: e2 } = await supabase.from("entries").select("id", { count: "exact", head: true }).eq("parent_id", selfId);
    if (e2) throw dbError(e2);
    if ((count ?? 0) > 0) throw new ApiError(400, "VALIDATION_ERROR", "하위 작업이 있는 할 일은 다른 할 일의 하위로 옮길 수 없습니다.");
  }
}

/** 목록 항목에 하위 작업 수(전체·완료)를 붙인다 */
export async function attachSubtaskCounts(supabase: SupabaseClient, items: Entry[]): Promise<EntryWithSubtasks[]> {
  const ids = items.map((e) => e.id);
  const counts = new Map<string, { total: number; done: number }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from("entries").select("parent_id, is_completed").in("parent_id", ids.slice(i, i + 200)).limit(5000);
    if (error) throw dbError(error);
    for (const r of (data ?? []) as { parent_id: string; is_completed: boolean | null }[]) {
      const c = counts.get(r.parent_id) ?? { total: 0, done: 0 };
      c.total++;
      if (r.is_completed) c.done++;
      counts.set(r.parent_id, c);
    }
  }
  return items.map((e) => ({ ...e, subtask_total: counts.get(e.id)?.total ?? 0, subtask_completed: counts.get(e.id)?.done ?? 0 }));
}

export function parseCategoryName(v: unknown) {
  return requireText(v, "분류 이름", 50);
}
