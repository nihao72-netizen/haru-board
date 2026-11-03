"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import { formatKoreanDate } from "@/lib/date";
import type { ReviewInfo, ReviewStatus } from "@/lib/quiz";

export const reviewStatusMeta: Record<ReviewStatus, { label: string; className: string }> = {
  pending: { label: "시작 전", className: "bg-amber-100 text-amber-900" },
  in_progress: { label: "진행 중", className: "bg-blue-100 text-blue-800" },
  completed: { label: "✓ 완료", className: "bg-green-100 text-green-800" },
};

/**
 * 월요일 오답 복습 회차 목록.
 * 이 화면에 들어오면 POST /prepare로 끝난 주의 빠진 회차를 만든다 (홈 GET은 만들지 않음, PRD 4.9).
 */
export function ReviewPanel() {
  const [reviews, setReviews] = useState<ReviewInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<ReviewInfo[]>("/api/hanja/reviews/prepare", { method: "POST" })
      .then((list) => {
        if (!cancelled) setReviews(list);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = reviews?.filter((r) => r.status !== "completed").length ?? 0;

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-labelledby="weekly-review">
      <div className="flex items-center justify-between gap-2">
        <h2 id="weekly-review" className="text-lg font-bold">
          월요일 오답 복습
        </h2>
        {open > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">미완료 {open}회차</span>}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        지난주(월~일)에 한 번이라도 틀린 일일 퀴즈 문제를 모아 다음 주 월요일부터 다시 풉니다.
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          복습 회차를 불러오지 못했습니다: {error}
        </p>
      ) : !reviews ? (
        <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>
      ) : reviews.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">
          아직 복습 회차가 없습니다. 첫 학습을 시작한 주가 끝나면 다음 주 월요일부터 복습할 수 있습니다.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {reviews.map((r) => {
            const meta = reviewStatusMeta[r.status];
            return (
              <li key={r.review_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{formatKoreanDate(r.review_week)} 복습</p>
                  <p className="text-xs text-gray-500">
                    {formatKoreanDate(r.source_start_date)} ~ {formatKoreanDate(r.source_end_date)} 오답 ·{" "}
                    {r.total_questions === 0 ? "틀린 문제 없음" : `${r.completed_questions}/${r.total_questions}문제`}
                  </p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                {r.total_questions > 0 && (
                  <Link
                    href={`/hanja/reviews/${r.review_id}`}
                    className="rounded bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-200"
                  >
                    {r.status === "completed" ? "결과 보기" : "풀기"}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
