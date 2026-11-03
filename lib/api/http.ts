import type { PostgrestError, SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** PRD 8.1/8.5 표준 응답 형식 */
export function ok<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function fail(status: number, code: string, message: string) {
  return Response.json({ success: false, error: { code, message } }, { status });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** 핸들러 본문에서 throw한 ApiError / 예상치 못한 오류를 표준 응답으로 바꾼다. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.code, e.message);
    console.error("[api] unexpected error", e);
    return fail(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/** 로그인 사용자 확인 (Auth 서버로 토큰 검증). 실패 시 401. */
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = await createClient();
  if (!supabase) throw new ApiError(500, "NOT_CONFIGURED", "Supabase 환경변수가 설정되지 않았습니다.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  return { supabase, user: data.user };
}

/** JSON 본문 파싱. 객체가 아니면 400. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "요청 본문이 올바른 JSON이 아닙니다.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_BODY", "요청 본문은 JSON 객체여야 합니다.");
  }
  return body as Record<string, unknown>;
}

/**
 * DB(PostgREST) 오류 → ApiError.
 * context로 FK 위반의 의미(삭제 시 '사용 중' vs 저장 시 '잘못된 참조')를 구분한다.
 */
export function dbError(
  error: PostgrestError,
  context: { fkMessage?: string; fkStatus?: number; duplicateMessage?: string } = {},
): ApiError {
  const code = error.code ?? "";
  switch (code) {
    case "23505":
      return new ApiError(409, "DUPLICATE", context.duplicateMessage ?? "이미 존재하는 항목입니다.");
    case "23503":
      return new ApiError(
        context.fkStatus ?? 400,
        context.fkStatus === 409 ? "IN_USE" : "INVALID_REFERENCE",
        context.fkMessage ?? "참조하는 항목이 없거나 사용할 수 없습니다.",
      );
    case "23514":
    case "23502":
    case "22P02":
    case "22007":
    case "22008":
    case "22001":
      return new ApiError(400, "VALIDATION_ERROR", "입력값이 올바르지 않습니다.");
    case "42501":
      return new ApiError(403, "FORBIDDEN", "접근 권한이 없습니다.");
    case "PGRST116":
      return new ApiError(404, "NOT_FOUND", "항목을 찾을 수 없습니다.");
    case "HB400":
      return new ApiError(400, "VALIDATION_ERROR", error.message);
    case "HB401":
      return new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    case "HB403":
      return new ApiError(403, "FORBIDDEN", error.message);
    case "HB404":
      return new ApiError(404, "NOT_FOUND", error.message);
    case "HB409":
      return new ApiError(409, "CONFLICT", error.message);
    default:
      console.error("[api] db error", error);
      return new ApiError(500, "DB_ERROR", "데이터 처리 중 오류가 발생했습니다.");
  }
}

/** 페이지네이션 파라미터 (PRD 8.5: 서버 최대치) */
export function pagination(params: URLSearchParams, maxLimit = 100, defaultLimit = 20) {
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const rawLimit = Number.parseInt(params.get("limit") ?? String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}
