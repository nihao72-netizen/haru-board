"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/api/client";
import { formatKoreanDate } from "@/lib/date";
import type { OptionId, ReviewInfo, ReviewItem, ReviewSummary } from "@/lib/quiz";
import { OptionList, quizButtonClass, ResultBox } from "../../quiz-ui";
import { reviewStatusMeta } from "../../review-panel";

type Detail = ReviewInfo & { items: ReviewItem[] };

export function ReviewSession() {
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<Detail>(`/api/hanja/reviews/${id}`), api<ReviewSummary>(`/api/hanja/reviews/${id}/summary`)])
      .then(([d, s]) => {
        if (cancelled) return;
        setDetail(d);
        setSummary(s);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  if (error && !detail) {
    return (
      <div role="alert" className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        복습 회차를 불러오지 못했습니다: {error}
      </div>
    );
  }
  if (!detail || !summary) return <div className="mt-8 rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>;

  const meta = reviewStatusMeta[summary.status];
  const pct = summary.total_questions ? (summary.completed_questions / summary.total_questions) * 100 : 100;

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-lg bg-white p-4 shadow sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{formatKoreanDate(detail.review_week)} 복습</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {formatKoreanDate(detail.source_start_date)} ~ {formatKoreanDate(detail.source_end_date)}에 틀린 문제
        </p>
        <div className="mt-3 flex justify-between text-sm text-gray-700">
          <span>
            진행 {summary.completed_questions}/{summary.total_questions}문제
          </span>
          <span>
            맞힘 {summary.correct_count} · 틀림 {summary.incorrect_count}
            {summary.accuracy_rate !== null && ` · 정답률 ${summary.accuracy_rate}%`}
          </span>
        </div>
        <div
          className="mt-1 h-2.5 rounded bg-gray-100"
          role="meter"
          aria-label="복습 진행률"
          aria-valuemin={0}
          aria-valuemax={summary.total_questions}
          aria-valuenow={summary.completed_questions}
        >
          <div className="h-full rounded bg-blue-600" style={{ width: `${pct}%` }} />
        </div>
        {summary.status === "completed" && (
          <p className="mt-3 rounded bg-green-50 p-3 text-sm text-green-800">이 회차의 복습을 모두 마쳤습니다. 수고하셨어요!</p>
        )}
      </section>

      {detail.items.length === 0 ? (
        <p className="rounded-lg bg-white p-6 text-sm text-gray-600 shadow">이 주에는 틀린 문제가 없었습니다.</p>
      ) : (
        <ol className="space-y-4">
          {detail.items.map((item, i) => (
            <ReviewQuestion key={item.item_id} reviewId={detail.review_id} item={item} index={i + 1} onDone={() => setToken((t) => t + 1)} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ReviewQuestion(props: { reviewId: string; item: ReviewItem; index: number; onDone: () => void }) {
  const { item } = props;
  const [selected, setSelected] = useState<OptionId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/hanja/reviews/${props.reviewId}/items/${item.item_id}/answer`, {
        method: "POST",
        body: JSON.stringify({ selected_option_id: selected }),
      });
      props.onDone();
    } catch (e) {
      setError(errorMessage(e));
      // 이미 다른 화면에서 제출된 문제면 최신 결과로 갱신
      if (e instanceof ClientApiError && e.status === 409) props.onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-lg bg-white p-4 shadow sm:p-6">
      <p className="text-xs font-semibold text-gray-500">
        문제 {props.index}
        {item.character && (
          <span className="ml-2 font-serif text-base text-gray-800" lang="zh-Hant">
            {item.character.character}
          </span>
        )}
      </p>
      <p className="mt-1 font-medium text-gray-900">{item.question}</p>
      <OptionList
        name={`review-${item.item_id}`}
        options={item.options}
        selected={selected}
        onSelect={setSelected}
        disabled={submitting}
        result={item.result}
      />
      {item.result ? (
        <ResultBox {...item.result} />
      ) : (
        <div className="mt-3">
          <button
            type="button"
            disabled={!selected || submitting}
            onClick={submit}
            className={`${quizButtonClass} bg-blue-600 text-white hover:bg-blue-700`}
          >
            {submitting ? "채점 중…" : "제출"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}
