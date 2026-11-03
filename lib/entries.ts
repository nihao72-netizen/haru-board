import { ApiError } from "@/lib/api/http";
import { isDateString, optionalText, requireDate, requireText, requireUuid } from "@/lib/validate";

export type EntryType = "todo" | "memo";

export type Entry = {
  id: string;
  category_id: string;
  type: EntryType;
  record_date: string;
  due_date: string | null;
  title: string;
  content: string | null;
  is_completed: boolean | null;
  created_at: string;
  updated_at: string;
};

export type EntryCategory = { id: string; name: string; created_at: string };

export const ENTRY_COLUMNS =
  "id, category_id, type, record_date, due_date, title, content, is_completed, created_at, updated_at";

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
  return {
    type,
    category_id: requireUuid(body.category_id, "분류"),
    record_date: requireDate(body.record_date, "기록 날짜"),
    due_date: parseDueDate(body.due_date),
    title: requireText(body.title, "제목", 200),
    content: optionalText(body.content, "내용"),
    is_completed: isCompleted as boolean | null,
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

export function parseCategoryName(v: unknown) {
  return requireText(v, "분류 이름", 50);
}
