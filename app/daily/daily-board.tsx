"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import type { DailyReview, DailySummary } from "@/lib/daily";
import { addDays, formatKoreanDate, formatKoreanDateTime, todayKST } from "@/lib/date";
import { formatSignedWon, formatWon } from "@/lib/format";

const buttonClass = "rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
const card = "rounded-lg bg-white p-4 shadow sm:p-6";
const statusLabel = { assigned: "배정됨", studying: "학습 중", completed: "✓ 학습 완료" } as const;

export function DailyBoard() {
  const today = todayKST();
  const [date, setDate] = useState(today);
  const [token, setToken] = useState(0);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = `${date}#${token}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let cancelled = false;
    const [d] = key.split("#");
    api<DailySummary>(`/api/daily-summary?date=${d}`)
      .then((s) => {
        if (cancelled) return;
        setSummary(s);
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

  const s = summary?.date === date ? summary : null;

  return (
    <div className="mt-8 space-y-6" aria-busy={loading}>
      <section className={`${card} flex flex-wrap items-center gap-2`} aria-label="날짜 선택">
        <button
          type="button"
          aria-label="전날"
          onClick={() => setDate((d) => addDays(d, -1))}
          className={`${buttonClass} bg-gray-100 py-1 hover:bg-gray-200`}
        >
          ◀
        </button>
        <input
          type="date"
          aria-label="날짜"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1 text-sm"
        />
        <button
          type="button"
          aria-label="다음날"
          onClick={() => setDate((d) => addDays(d, 1))}
          className={`${buttonClass} bg-gray-100 py-1 hover:bg-gray-200`}
        >
          ▶
        </button>
        {date !== today && (
          <button type="button" onClick={() => setDate(today)} className={`${buttonClass} py-1 text-blue-700`}>
            오늘
          </button>
        )}
        <p className="w-full text-lg font-bold text-gray-900 sm:ml-2 sm:w-auto">{formatKoreanDate(date)}</p>
      </section>

      {error && !s ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          기록을 불러오지 못했습니다: {error}
          <button type="button" className="ml-2 underline" onClick={() => setToken((t) => t + 1)}>
            다시 시도
          </button>
        </div>
      ) : !s ? (
        <div className={`${card} text-sm text-gray-500`}>불러오는 중…</div>
      ) : (
        <>
          {/* 1. 할 일 */}
          <section className={card} aria-labelledby="d-todos">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="d-todos" className="text-lg font-bold">
                할 일
              </h2>
              <span className="text-sm text-gray-600">
                {s.todos.total === 0 ? "기록 없음" : `${s.todos.total}개 중 ${s.todos.completed}개 완료`}
              </span>
            </div>
            {s.todos.total > 0 && (
              <ul className="mt-3 space-y-1">
                {s.todos.items.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <span aria-hidden="true" className={t.is_completed ? "text-green-700" : "text-gray-400"}>
                      {t.is_completed ? "☑" : "☐"}
                    </span>
                    <span className={t.is_completed ? "text-gray-500 line-through" : "text-gray-900"}>{t.title}</span>
                    <span className="sr-only">{t.is_completed ? "(완료)" : "(미완료)"}</span>
                    {t.category_name && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{t.category_name}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-gray-500">완료 표시는 그날 당시가 아니라 현재 상태입니다.</p>
          </section>

          {/* 2. 메모 */}
          <section className={card} aria-labelledby="d-memos">
            <h2 id="d-memos" className="text-lg font-bold">
              메모
            </h2>
            {s.memos.total === 0 ? (
              <p className="mt-2 text-sm text-gray-500">이날 남긴 메모가 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {s.memos.items.map((m) => (
                  <li key={m.id} className="border-l-2 border-gray-200 pl-3 text-sm">
                    <p className="font-medium text-gray-900">{m.title}</p>
                    {m.content && <p className="mt-1 whitespace-pre-wrap break-words text-gray-700">{m.content}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. 가계부 */}
          <section className={card} aria-labelledby="d-finance">
            <h2 id="d-finance" className="text-lg font-bold">
              가계부
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded bg-blue-50 p-2">
                <p className="text-xs text-blue-800">수입</p>
                <p className="font-bold text-blue-900">{formatWon(s.finance.total_income)}</p>
              </div>
              <div className="rounded bg-red-50 p-2">
                <p className="text-xs text-red-800">지출</p>
                <p className="font-bold text-red-900">{formatWon(s.finance.total_expense)}</p>
              </div>
              <div className="rounded bg-gray-100 p-2">
                <p className="text-xs text-gray-700">차액</p>
                <p className="font-bold text-gray-900">{formatSignedWon(s.finance.balance)}</p>
              </div>
            </div>
            {s.finance.items.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">이날 기록한 거래가 없습니다.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100 text-sm">
                {s.finance.items.map((t) => (
                  <li key={t.id} className="flex items-baseline gap-2 py-1.5">
                    <span className={`shrink-0 text-xs font-semibold ${t.type === "income" ? "text-blue-700" : "text-red-700"}`}>
                      {t.type === "income" ? "수입" : "지출"}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-gray-900">
                      {t.name}
                      {t.memo && <span className="ml-1 text-xs text-gray-500">· {t.memo}</span>}
                    </span>
                    {t.category_name && <span className="shrink-0 text-xs text-gray-500">{t.category_name}</span>}
                    <span className="shrink-0 font-medium">{formatWon(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 4. 한자·퀴즈 */}
          <section className={card} aria-labelledby="d-hanja">
            <h2 id="d-hanja" className="text-lg font-bold">
              한자·퀴즈
            </h2>
            {s.hanja.learning ? (
              <p className="mt-2 flex items-center gap-3">
                <span className="font-serif text-4xl" lang="zh-Hant">
                  {s.hanja.learning.character.character}
                </span>
                <span className="text-sm text-gray-800">
                  {s.hanja.learning.character.meaning} {s.hanja.learning.character.reading}
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{statusLabel[s.hanja.learning.status]}</span>
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-500">이날 배정된 한자가 없습니다.</p>
            )}
            {(["daily_attempts", "review_attempts"] as const).map((k) => {
              const list = s.hanja[k];
              if (list.length === 0) return null;
              const correct = list.filter((a) => a.is_correct).length;
              return (
                <div key={k} className="mt-3">
                  <p className="text-sm font-semibold text-gray-700">
                    {k === "daily_attempts" ? "일일 퀴즈" : "오답 복습"} {list.length}회 · 정답 {correct}회
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                    {list.slice(0, 10).map((a) => (
                      <li key={a.attempt_id}>
                        {a.is_correct ? "✓ 정답" : "✕ 오답"} · {a.question} ({formatKoreanDateTime(a.attempted_at)})
                      </li>
                    ))}
                    {list.length > 10 && <li>외 {list.length - 10}회</li>}
                  </ul>
                </div>
              );
            })}
            {s.hanja.daily_attempts.length === 0 && s.hanja.review_attempts.length === 0 && (
              <p className="mt-2 text-sm text-gray-500">이날 푼 퀴즈가 없습니다.</p>
            )}
          </section>

          {/* 5. 자유 일기 */}
          <DiaryEditor key={date} date={date} diary={s.diary} onSaved={() => setToken((t) => t + 1)} />

          <p className="text-center text-xs text-gray-500">
            기록을 고치려면{" "}
            <Link href="/todos" className="underline">
              할 일
            </Link>
            ·
            <Link href="/ledger" className="underline">
              가계부
            </Link>
            ·
            <Link href="/hanja" className="underline">
              한자
            </Link>{" "}
            화면을 이용해 주세요.
          </p>
        </>
      )}
    </div>
  );
}

function DiaryEditor(props: { date: string; diary: DailyReview | null; onSaved: () => void }) {
  const [content, setContent] = useState(props.diary?.content ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const changed = content !== (props.diary?.content ?? "");

  async function save() {
    if (!content.trim()) return setMessage({ kind: "error", text: "일기 내용을 입력해 주세요." });
    setBusy(true);
    try {
      await api("/api/daily-reviews", { method: "PUT", body: JSON.stringify({ review_date: props.date, content }) });
      setMessage({ kind: "success", text: "일기를 저장했습니다." });
      props.onSaved();
    } catch (e) {
      setMessage({ kind: "error", text: `저장하지 못했습니다: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("이날의 일기를 삭제할까요? 할 일·가계부 등 다른 기록은 그대로 남습니다.")) return;
    setBusy(true);
    try {
      await api(`/api/daily-reviews?date=${props.date}`, { method: "DELETE" });
      setContent("");
      setMessage({ kind: "success", text: "일기를 삭제했습니다." });
      props.onSaved();
    } catch (e) {
      setMessage({ kind: "error", text: `삭제하지 못했습니다: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card} aria-labelledby="d-diary">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="d-diary" className="text-lg font-bold">
          자유 일기
        </h2>
        {props.diary && (
          <span className="text-xs text-gray-500">마지막 저장 {formatKoreanDateTime(props.diary.updated_at)}</span>
        )}
      </div>
      <label htmlFor="diary" className="sr-only">
        일기 내용
      </label>
      <textarea
        id="diary"
        rows={6}
        maxLength={10000}
        value={content}
        placeholder="오늘 하루를 자유롭게 적어 보세요."
        onChange={(e) => {
          setContent(e.target.value);
          setMessage(null);
        }}
        className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`mt-2 text-sm ${message.kind === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy || !changed}
          onClick={save}
          className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
        >
          {busy ? "저장 중…" : props.diary ? "수정 저장" : "저장"}
        </button>
        {props.diary && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className={`${buttonClass} bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50`}
          >
            삭제
          </button>
        )}
      </div>
    </section>
  );
}
