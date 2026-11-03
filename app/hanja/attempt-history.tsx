"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import { formatKoreanDateTime } from "@/lib/date";
import type { AttemptRecord } from "@/lib/quiz";

type Result = { items: AttemptRecord[]; page: number; total: number };
const LIMIT = 10;

/** 최근 풀이 기록 (일일 퀴즈 + 복습) */
export function AttemptHistory({ refreshToken }: { refreshToken: number }) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AttemptRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState(refreshToken);

  // 새 풀이가 생기면 첫 페이지부터 다시
  if (lastToken !== refreshToken) {
    setLastToken(refreshToken);
    setPage(1);
  }
  const key = `${page}#${refreshToken}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let cancelled = false;
    const [p] = key.split("#");
    api<Result>(`/api/hanja/quizzes/attempts?page=${p}&limit=${LIMIT}`)
      .then((r) => {
        if (cancelled) return;
        setItems((prev) => (r.page === 1 ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-labelledby="attempt-history" aria-busy={loading}>
      <h2 id="attempt-history" className="text-lg font-bold">
        풀이 기록
      </h2>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          풀이 기록을 불러오지 못했습니다: {error}
        </p>
      ) : loading && items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">아직 푼 문제가 없습니다.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-100">
            {items.map((a) => (
              <li key={a.attempt_id} className="flex items-start gap-3 py-2 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${
                    a.is_correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {a.is_correct ? "✓ 정답" : "✕ 오답"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900">
                    {a.character && (
                      <span className="mr-1 font-serif text-base" lang="zh-Hant">
                        {a.character.character}
                      </span>
                    )}
                    {a.question}
                  </p>
                  <p className="text-xs text-gray-500">
                    내 답 {a.selected_option_id}. {a.selected_answer}
                    {!a.is_correct && a.correct_answer && ` · 정답 ${a.correct_option_id}. ${a.correct_answer}`}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-gray-500">
                  <p>{a.attempt_type === "daily" ? "일일" : "복습"}</p>
                  <p>{formatKoreanDateTime(a.attempted_at)}</p>
                </div>
              </li>
            ))}
          </ul>
          {items.length < total && (
            <div className="mt-3 text-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-800 hover:bg-gray-200 disabled:opacity-50"
              >
                {loading ? "불러오는 중…" : `더 보기 (${items.length}/${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
