"use client";

import { useEffect, useState } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/api/client";
import { formatKoreanDate, todayKST } from "@/lib/date";
import type { HanjaDetail, HanjaProgress, LearningRecord, LearningStatus } from "@/lib/hanja";
import { AttemptHistory } from "./attempt-history";
import { QuizCard } from "./quiz-card";
import { ReviewPanel } from "./review-panel";

type Notice = { kind: "success" | "error" | "info"; text: string } | null;
type HistoryResult = { items: LearningRecord[]; total: number };
type Loaded = { today: LearningRecord | null; progress: HanjaProgress; history: HistoryResult };

const buttonClass = "rounded px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

const statusMeta: Record<LearningStatus, { label: string; className: string }> = {
  assigned: { label: "배정됨", className: "bg-gray-100 text-gray-700" },
  studying: { label: "학습 중", className: "bg-blue-100 text-blue-800" },
  completed: { label: "✓ 학습 완료", className: "bg-green-100 text-green-800" },
};

function StatusBadge({ status }: { status: LearningStatus }) {
  const meta = statusMeta[status];
  return <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>;
}

export function HanjaBoard() {
  const today = todayKST();
  const [token, setToken] = useState(0);
  const [data, setData] = useState<Loaded | null>(null);
  const [loadedToken, setLoadedToken] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answerToken, setAnswerToken] = useState(0);

  const loading = loadedToken !== token;
  const reload = () => setToken((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<LearningRecord | null>("/api/hanja/today"),
      api<HanjaProgress>("/api/hanja/progress"),
      api<HistoryResult>("/api/hanja/learning?limit=100"),
    ])
      .then(([t, p, h]) => {
        if (cancelled) return;
        setData({ today: t, progress: p, history: h });
        setLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoadedToken(token);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function assign() {
    setBusy(true);
    try {
      const r = await api<LearningRecord & { is_new_assignment: boolean }>("/api/hanja/today/assign", { method: "POST" });
      setNotice({
        kind: "success",
        text: r.is_new_assignment ? `오늘의 한자 '${r.character.character}'를 받았습니다.` : "오늘의 한자는 이미 받았습니다.",
      });
      reload();
    } catch (e) {
      const exhausted = e instanceof ClientApiError && e.code === "HANJA_EXHAUSTED";
      setNotice({ kind: exhausted ? "info" : "error", text: errorMessage(e) });
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(record: LearningRecord, status: "studying" | "completed") {
    setBusy(true);
    try {
      await api(`/api/hanja/learning/${record.learning_id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice({
        kind: "success",
        text: status === "studying" ? "학습을 시작했습니다." : `'${record.character.character}' 학습을 완료했습니다.`,
      });
      reload();
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (loadError && !data) {
    return (
      <div role="alert" className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        한자 정보를 불러오지 못했습니다: {loadError}
        <button type="button" className="ml-2 underline" onClick={reload}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!data) return <div className="mt-8 rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>;

  const { today: rec, progress, history } = data;
  const past = history.items.filter((h) => h.learning_date !== today);
  const exhausted = progress.remaining_count === 0;

  return (
    <div className="mt-8 space-y-6" aria-busy={loading}>
      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded border px-4 py-3 text-sm ${
            notice.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : notice.kind === "info"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs underline">
            닫기
          </button>
        </div>
      )}

      {/* 오늘의 한자 */}
      <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-labelledby="today-hanja">
        <div className="flex items-center justify-between gap-2">
          <h2 id="today-hanja" className="text-lg font-bold">
            {formatKoreanDate(today)} 한자
          </h2>
          {rec && <StatusBadge status={rec.status} />}
        </div>

        {!rec ? (
          exhausted ? (
            <p className="mt-4 rounded bg-amber-50 p-4 text-sm text-amber-900">
              준비된 한자 {progress.total_characters}자를 모두 배정받았습니다. 새 한자가 추가될 때까지 아래 지난 한자를 복습해 주세요.
            </p>
          ) : (
            <div className="mt-4 rounded bg-gray-50 p-6 text-center">
              <p className="text-sm text-gray-600">오늘의 한자를 아직 받지 않았습니다.</p>
              <button
                type="button"
                disabled={busy}
                onClick={assign}
                className={`${buttonClass} mt-3 bg-blue-600 text-white hover:bg-blue-700`}
              >
                {busy ? "받는 중…" : "오늘의 한자 받기"}
              </button>
              <p className="mt-2 text-xs text-gray-500">남은 글자 {progress.remaining_count}자 · 하루에 한 글자씩 새로 배정됩니다.</p>
            </div>
          )
        ) : (
          <>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-6">
              <p className="font-serif text-8xl leading-none text-gray-900" lang="zh-Hant">
                {rec.character.character}
              </p>
              <div className="text-center sm:text-left">
                <p className="text-2xl font-bold text-gray-900">
                  {rec.character.meaning} <span className="text-blue-700">{rec.character.reading}</span>
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  음 <strong className="text-gray-800">{rec.character.reading}</strong> · 뜻{" "}
                  <strong className="text-gray-800">{rec.character.meaning}</strong>
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {rec.status === "assigned" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeStatus(rec, "studying")}
                  className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
                >
                  학습 시작
                </button>
              )}
              {rec.status === "studying" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeStatus(rec, "completed")}
                  className={`${buttonClass} bg-green-600 text-white hover:bg-green-700`}
                >
                  학습 완료
                </button>
              )}
              {rec.status === "completed" && rec.completed_at && (
                <p className="text-sm text-green-800">오늘의 학습을 마쳤습니다. 아래 단어와 예문으로 한 번 더 복습해 보세요.</p>
              )}
              {rec.status === "assigned" && <p className="text-xs text-gray-500">학습 시작을 누르면 진행 상태가 기록됩니다.</p>}
            </div>
            <HanjaDetailView key={rec.character.id} id={rec.character.id} />
          </>
        )}
      </section>

      {/* 오늘 배정이 바뀌면 퀴즈를 새로 불러옴 */}
      <QuizCard key={rec?.learning_id ?? "none"} hasToday={!!rec} onAnswered={() => {
          setAnswerToken((t) => t + 1);
          reload(); // 진행 현황(풀이 수·정답률) 갱신
        }}
      />

      <ReviewPanel />

      {/* 진행 현황 */}
      <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-labelledby="hanja-progress">
        <h2 id="hanja-progress" className="text-lg font-bold">
          진행 현황
        </h2>
        <div className="mt-3">
          <div className="flex justify-between text-sm text-gray-700">
            <span>배정 {progress.assigned_count}자 / 전체 {progress.total_characters}자</span>
            <span>완료 {progress.completed_count}자</span>
          </div>
          <div
            className="mt-1 h-2.5 rounded bg-gray-100"
            role="meter"
            aria-label="학습 완료 비율"
            aria-valuemin={0}
            aria-valuemax={progress.total_characters}
            aria-valuenow={progress.completed_count}
          >
            <div
              className="h-full rounded bg-green-600"
              style={{ width: `${progress.total_characters ? (progress.completed_count / progress.total_characters) * 100 : 0}%` }}
            />
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[
            ["학습 중", `${progress.studying_count}자`],
            ["남은 글자", `${progress.remaining_count}자`],
            ["퀴즈 풀이", `${progress.attempts.total}회`],
            ["정답률", progress.attempts.accuracy_rate === null ? "기록 없음" : `${progress.attempts.accuracy_rate}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded bg-gray-50 p-3">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="mt-1 font-bold text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
        {progress.first_learning_date && (
          <p className="mt-2 text-xs text-gray-500">첫 학습일 {formatKoreanDate(progress.first_learning_date)}</p>
        )}
      </section>

      <AttemptHistory refreshToken={answerToken} />

      {/* 지난 한자 */}
      <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-labelledby="hanja-history">
        <h2 id="hanja-history" className="text-lg font-bold">
          지난 한자
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">아직 지난 한자가 없습니다. 내일 새 한자가 배정됩니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {past.map((h) => {
              const open = openId === h.learning_id;
              return (
                <li key={h.learning_id} className="py-3">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : h.learning_id)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <span className="font-serif text-3xl text-gray-900" lang="zh-Hant">
                      {h.character.character}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-gray-900">
                        {h.character.meaning} {h.character.reading}
                      </span>
                      <span className="block text-xs text-gray-500">{formatKoreanDate(h.learning_date)}</span>
                    </span>
                    <StatusBadge status={h.status} />
                    <span className="text-xs text-gray-500">{open ? "접기 ▲" : "보기 ▼"}</span>
                  </button>
                  {open && (
                    <div className="mt-2">
                      {h.status !== "completed" && (
                        <div className="mb-2 flex gap-2">
                          {h.status === "assigned" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => changeStatus(h, "studying")}
                              className={`${buttonClass} bg-blue-600 py-1 text-white`}
                            >
                              학습 시작
                            </button>
                          )}
                          {h.status === "studying" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => changeStatus(h, "completed")}
                              className={`${buttonClass} bg-green-600 py-1 text-white`}
                            >
                              학습 완료
                            </button>
                          )}
                        </div>
                      )}
                      <HanjaDetailView id={h.character.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** 한자 상세: 구성 설명·난이도·관련 단어·예문 */
function HanjaDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<HanjaDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<HanjaDetail>(`/api/hanja/${id}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="mt-4 text-sm text-red-700">상세 정보를 불러오지 못했습니다: {error}</p>;
  if (!detail) return <p className="mt-4 text-sm text-gray-500">상세 정보를 불러오는 중…</p>;

  return (
    <div className="mt-4 space-y-4 rounded bg-gray-50 p-4">
      {detail.explanation && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700">구성과 설명</h3>
          <p className="mt-1 text-sm text-gray-800">{detail.explanation}</p>
        </div>
      )}
      {detail.difficulty !== null && (
        <p className="text-sm text-gray-700">
          난이도{" "}
          <span aria-label={`5단계 중 ${detail.difficulty}단계`}>
            <span className="text-amber-500">{"★".repeat(detail.difficulty)}</span>
            <span className="text-gray-300">{"★".repeat(5 - detail.difficulty)}</span>
          </span>{" "}
          <span className="text-xs text-gray-500">({detail.difficulty}/5)</span>
        </p>
      )}
      <div>
        <h3 className="text-sm font-semibold text-gray-700">관련 단어와 예문</h3>
        {detail.words.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">등록된 단어가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {detail.words.map((w) => (
              <li key={w.id} className="rounded bg-white p-3 shadow-sm">
                <p>
                  <span className="font-serif text-xl text-gray-900" lang="zh-Hant">
                    {w.word}
                  </span>{" "}
                  <span className="font-semibold text-blue-700">{w.reading}</span>
                </p>
                <p className="mt-1 text-sm text-gray-700">{w.meaning}</p>
                {w.examples.map((ex) => (
                  <p key={ex.id} className="mt-2 border-l-2 border-gray-200 pl-2 text-sm text-gray-600">
                    {ex.sentence}
                    {ex.explanation && <span className="block text-xs text-gray-500">{ex.explanation}</span>}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
