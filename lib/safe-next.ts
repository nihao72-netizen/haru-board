/**
 * 리다이렉트 대상 경로 검증. 같은 사이트 내부의 상대 경로("/..."로 시작, "//" 금지)만 허용한다.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
