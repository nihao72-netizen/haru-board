/** 브라우저에서 우리 API(/api/*)를 호출하는 헬퍼. 표준 응답 형식을 풀어서 돌려준다. */

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ClientApiError(0, "NETWORK_ERROR", "네트워크 오류가 발생했습니다. 연결을 확인해 주세요.");
  }
  if (res.status === 204) return undefined as T;

  let body: { success?: boolean; data?: T; error?: { code: string; message: string } } | null = null;
  try {
    body = await res.json();
  } catch {
    // JSON이 아닌 응답 (예: 로그인 페이지로 리다이렉트된 HTML)
  }
  if (!res.ok || !body?.success) {
    if (res.status === 401) {
      throw new ClientApiError(401, "UNAUTHORIZED", "로그인이 필요합니다. 다시 로그인해 주세요.");
    }
    throw new ClientApiError(
      res.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? "요청을 처리하지 못했습니다.",
    );
  }
  return body.data as T;
}

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
