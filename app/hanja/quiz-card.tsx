"use client";

import { useEffect, useRef, useState } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/api/client";
import type { GradeResult, OptionId, TodayQuiz } from "@/lib/quiz";
import { OptionList, quizButtonClass, ResultBox } from "./quiz-ui";

/** 오늘의 퀴즈: 오늘 배정된 한자 1문제. 반복 풀이 허용, 네트워크 재시도는 같은 request_id로 */
export function QuizCard({ hasToday, onAnswered }: { hasToday: boolean; onAnswered: () => void }) {
  const [quiz, setQuiz] = useState<TodayQuiz | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OptionId | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  // 응답을 못 받은 제출: 같은 보기로 다시 보내면 같은 request_id를 사용해 중복 기록을 막는다
  const pending = useRef<{ option: OptionId; requestId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<TodayQuiz | null>("/api/hanja/quizzes/today")
      .then((q) => {
        if (cancelled) return;
        setQuiz(q);
        setAttemptCount(q?.attempt_count ?? 0);
        setLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (!quiz || !selected) return;
    if (!pending.current || pending.current.option !== selected) {
      pending.current = { option: selected, requestId: crypto.randomUUID() };
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<GradeResult>("/api/hanja/quizzes/attempts", {
        method: "POST",
        body: JSON.stringify({ question_id: quiz.question_id, selected_option_id: selected, request_id: pending.current.requestId }),
      });
      pending.current = null;
      setResult(r);
      if (!r.is_duplicate) setAttemptCount((c) => c + 1);
      onAnswered();
    } catch (e) {
      // 네트워크 오류가 아니면 같은 요청 번호를 다시 쓰지 않음
      if (!(e instanceof ClientApiError && e.status === 0)) pending.current = null;
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setResult(null);
    setSelected(null);
    setError(null);
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-labelledby="today-quiz">
      <div className="flex items-center justify-between gap-2">
        <h2 id="today-quiz" className="text-lg font-bold">
          오늘의 퀴즈
        </h2>
        {attemptCount > 0 && <span className="text-xs text-gray-500">오늘 {attemptCount}번 풀었어요</span>}
      </div>

      {!loaded ? (
        <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>
      ) : loadError ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          퀴즈를 불러오지 못했습니다: {loadError}
        </p>
      ) : !quiz ? (
        <p className="mt-3 text-sm text-gray-600">
          {hasToday ? "오늘 한자의 퀴즈가 아직 준비되지 않았습니다." : "오늘의 한자를 먼저 받으면 퀴즈를 풀 수 있습니다."}
        </p>
      ) : (
        <>
          <p className="mt-3 font-medium text-gray-900">
            <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {quiz.question_type === "reading" ? "음" : "뜻"}
            </span>
            {quiz.question}
          </p>
          <OptionList
            name="today-quiz"
            options={quiz.options}
            selected={selected}
            onSelect={setSelected}
            disabled={submitting}
            result={result}
          />
          {result && <ResultBox {...result} />}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {result ? (
              <button type="button" onClick={retry} className={`${quizButtonClass} bg-gray-800 text-white hover:bg-gray-900`}>
                다시 풀기
              </button>
            ) : (
              <button
                type="button"
                disabled={!selected || submitting}
                onClick={submit}
                className={`${quizButtonClass} bg-blue-600 text-white hover:bg-blue-700`}
              >
                {submitting ? "채점 중…" : "제출"}
              </button>
            )}
            <p className="text-xs text-gray-500">여러 번 풀어도 됩니다. 틀린 문제는 다음 주 월요일 복습에 나옵니다.</p>
          </div>
        </>
      )}
    </section>
  );
}
