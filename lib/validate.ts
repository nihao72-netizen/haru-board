import { ApiError } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** YYYY-MM-DD 형식이고 실제 존재하는 날짜인지 */
export function isDateString(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function requireUuid(v: unknown, field: string): string {
  if (!isUuid(v)) throw new ApiError(400, "VALIDATION_ERROR", `${field} 값이 올바른 ID가 아닙니다.`);
  return v;
}

export function requireDate(v: unknown, field: string): string {
  if (!isDateString(v)) throw new ApiError(400, "VALIDATION_ERROR", `${field}는 YYYY-MM-DD 형식이어야 합니다.`);
  return v;
}

/** 앞뒤 공백 제거 후 1~max자. 공백만 있으면 오류 */
export function requireText(v: unknown, field: string, max: number): string {
  if (typeof v !== "string") throw new ApiError(400, "VALIDATION_ERROR", `${field}을(를) 입력해 주세요.`);
  const t = v.trim();
  if (t.length === 0) throw new ApiError(400, "VALIDATION_ERROR", `${field}을(를) 입력해 주세요.`);
  if (t.length > max) throw new ApiError(400, "VALIDATION_ERROR", `${field}은(는) ${max}자 이하로 입력해 주세요.`);
  return t;
}

/** 선택 텍스트: 없거나 빈 문자열이면 null */
export function optionalText(v: unknown, field: string, max = 10000): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new ApiError(400, "VALIDATION_ERROR", `${field} 형식이 올바르지 않습니다.`);
  const t = v.trim();
  if (t.length === 0) return null;
  if (t.length > max) throw new ApiError(400, "VALIDATION_ERROR", `${field}은(는) ${max}자 이하로 입력해 주세요.`);
  return t;
}

/**
 * PostgREST or() 필터 값용 인용. 쉼표·괄호가 들어간 검색어도 안전하게 전달한다.
 * ILIKE 와일드카드(%, _)는 문자 그대로 검색되도록 이스케이프한다.
 */
export function ilikeValue(search: string): string {
  const escapedLike = search.replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = `*${escapedLike}*`.replace(/["\\]/g, (c) => `\\${c}`);
  return `"${quoted}"`;
}
