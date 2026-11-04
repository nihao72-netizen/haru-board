"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/api/client";
import { DIARY_MAX, DIARY_TITLE_MAX, DIARY_UNLOCK_MS, type DailyReview, type DiaryWithContent } from "@/lib/diary";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";

const buttonClass = "rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
const card = "rounded-lg bg-white p-4 shadow sm:p-6";
const inputClass = "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const clock = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });

/** 잠금 해제 상태: 비밀번호를 다시 확인한 시각 + 10분 (DB도 같은 기준으로 확인). 만료되면 상위에서 null로 바꾼다 */
export type Unlock = { until: number | null; set: (until: number | null) => void };

/** 비밀번호 재확인 창: 같은 이메일로 다시 로그인해 '최근 비밀번호 확인' 세션을 만든다 */
export function UnlockDialog(props: { onClose: () => void; onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError("비밀번호를 입력해 주세요.");
    const supabase = createClient();
    if (!supabase) return setError("Supabase 설정이 없습니다.");
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) return setError("로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.");
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setPassword("");
        return setError(authError.status === 429 ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." : "비밀번호가 올바르지 않습니다.");
      }
      props.onUnlocked();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={props.onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && props.onClose()}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id="unlock-title" className="text-lg font-bold">
          🔒 비밀번호 확인
        </h2>
        <p className="mt-1 text-sm text-gray-600">일기 내용을 보려면 로그인 비밀번호를 한 번 더 입력해 주세요.</p>
        <label htmlFor="unlock-password" className="sr-only">
          비밀번호
        </label>
        <input
          id="unlock-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          className={`mt-3 ${inputClass}`}
          placeholder="비밀번호"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className={`${buttonClass} bg-gray-100 hover:bg-gray-200`}>
            취소
          </button>
          <button type="submit" disabled={busy} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
            {busy ? "확인 중…" : "확인"}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">확인 후 10분 동안은 다른 일기도 다시 묻지 않고 열 수 있습니다.</p>
      </form>
    </div>
  );
}

/** 그날의 자유 일기: 제목 + 본문. 이미 쓴 일기는 비밀번호를 다시 확인해야 본문이 열린다 */
export function DiaryEditor(props: { date: string; diary: DailyReview | null; unlock: Unlock; promptToken: number; onSaved: () => void }) {
  const { unlock } = props;
  const [loaded, setLoaded] = useState<DiaryWithContent | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [handledToken, setHandledToken] = useState(0);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const exists = props.diary !== null || loaded !== null;
  const locked = exists && loaded === null;
  // 목록에서 이 날짜를 골랐으면 비밀번호 창을 바로 연다
  const unlocked = unlock.until !== null;
  const asking = askOpen || (locked && props.promptToken > handledToken && !unlocked);
  const changed = loaded ? title.trim() !== (loaded.title ?? "") || content !== loaded.content : title.trim() !== "" || content !== "";

  function show(d: DiaryWithContent) {
    setLoaded(d);
    setTitle(d.title ?? "");
    setContent(d.content);
  }

  const { date } = props;
  const setUnlock = unlock.set;
  /** 본문 요청. 비밀번호 확인이 만료됐으면(403 REAUTH_REQUIRED) 비밀번호 창을 연다 */
  const load = useCallback(
    () =>
      api<DiaryWithContent>(`/api/daily-reviews/content?date=${date}`)
        .then((d) => {
          setLoaded(d);
          setTitle(d.title ?? "");
          setContent(d.content);
        })
        .catch((e) => {
          if (e instanceof ClientApiError && e.code === "REAUTH_REQUIRED") {
            setUnlock(null);
            setAskOpen(true);
          } else setMessage({ kind: "error", text: `일기를 열지 못했습니다: ${errorMessage(e)}` });
        }),
    [date, setUnlock],
  );

  async function open() {
    setBusy(true);
    setMessage(null);
    await load();
    setBusy(false);
  }

  // 목록에서 고른 일기로 스크롤하고, 이미 잠금 해제 상태면 바로 연다 (고를 때마다 한 번)
  const handledScroll = useRef(0);
  const hasDiary = props.diary !== null;
  useEffect(() => {
    if (!props.promptToken || handledScroll.current === props.promptToken) return;
    handledScroll.current = props.promptToken;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // 바로 열었으면 이 선택은 처리 끝 (나중에 잠그거나 만료돼도 비밀번호 창이 저절로 뜨지 않게)
    const token = props.promptToken;
    if (hasDiary && unlocked) void load().then(() => setHandledToken(token));
  }, [props.promptToken, hasDiary, unlocked, load]);

  // 잠금 시간이 지나면(해제 → 만료) 다시 잠근다. 고치는 중이면 그대로 둠
  const wasUnlocked = useRef(unlocked);
  useEffect(() => {
    const expired = wasUnlocked.current && !unlocked;
    wasUnlocked.current = unlocked;
    if (!expired || !loaded || changed) return;
    const t = setTimeout(() => setLoaded(null), 0);
    return () => clearTimeout(t);
  }, [unlocked, loaded, changed]);

  function requestOpen() {
    if (unlocked) void open();
    else setAskOpen(true);
  }

  async function save() {
    if (!content.trim()) return setMessage({ kind: "error", text: "일기 내용을 입력해 주세요." });
    setBusy(true);
    try {
      const saved = await api<DailyReview>("/api/daily-reviews", {
        method: "PUT",
        body: JSON.stringify({ review_date: props.date, title: title.trim() || null, content }),
      });
      show({ ...saved, content: content.trim() });
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
      setLoaded(null);
      setTitle("");
      setContent("");
      setMessage({ kind: "success", text: "일기를 삭제했습니다." });
      props.onSaved();
    } catch (e) {
      setMessage({ kind: "error", text: `삭제하지 못했습니다: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  }

  function lockNow() {
    setHandledToken(props.promptToken);
    setLoaded(null);
    setMessage(null);
    unlock.set(null);
  }

  const meta = loaded ?? props.diary;
  return (
    <section ref={sectionRef} className={`${card} scroll-mt-4`} aria-labelledby="d-diary">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="d-diary" className="text-lg font-bold">
          자유 일기
        </h2>
        {meta && <span className="text-xs text-gray-500">마지막 저장 {formatKoreanDateTime(meta.updated_at)}</span>}
      </div>

      {locked ? (
        <div className="mt-3 rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
          <p className="font-medium text-gray-900">{props.diary?.title ?? "(제목 없음)"}</p>
          <p className="mt-1 text-sm text-gray-600">🔒 일기 내용은 잠겨 있습니다.</p>
          <button type="button" disabled={busy} onClick={requestOpen} className={`${buttonClass} mt-3 bg-blue-600 text-white hover:bg-blue-700`}>
            {busy ? "여는 중…" : "비밀번호 입력하고 보기"}
          </button>
        </div>
      ) : (
        <>
          <label htmlFor="diary-title" className="sr-only">
            일기 제목
          </label>
          <input
            id="diary-title"
            value={title}
            maxLength={DIARY_TITLE_MAX}
            placeholder="제목 (선택)"
            onChange={(e) => {
              setTitle(e.target.value);
              setMessage(null);
            }}
            className={`mt-3 font-medium ${inputClass}`}
          />
          <label htmlFor="diary" className="sr-only">
            일기 내용
          </label>
          <textarea
            id="diary"
            rows={10}
            maxLength={DIARY_MAX}
            value={content}
            placeholder="오늘 하루를 자유롭게 적어 보세요."
            onChange={(e) => {
              setContent(e.target.value);
              setMessage(null);
            }}
            className={`mt-2 ${inputClass}`}
          />
        </>
      )}

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`mt-2 text-sm ${message.kind === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      )}

      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || !changed} onClick={save} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
            {busy ? "저장 중…" : exists ? "수정 저장" : "저장"}
          </button>
          {exists && (
            <>
              <button type="button" disabled={busy} onClick={remove} className={`${buttonClass} bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50`}>
                삭제
              </button>
              <button type="button" disabled={busy} onClick={lockNow} className={`${buttonClass} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
                🔒 잠그기
              </button>
            </>
          )}
          {exists && unlock.until !== null && (
            <span className="text-xs text-gray-500">{clock.format(new Date(unlock.until))}까지 잠금 해제</span>
          )}
        </div>
      )}

      {asking && (
        <UnlockDialog
          onClose={() => {
            setAskOpen(false);
            setHandledToken(props.promptToken);
          }}
          onUnlocked={() => {
            setAskOpen(false);
            setHandledToken(props.promptToken);
            unlock.set(Date.now() + DIARY_UNLOCK_MS - 30_000);
            void open();
          }}
        />
      )}
    </section>
  );
}

type DiaryPage = { items: DailyReview[]; page: number; limit: number; total: number };

/** 내 일기 목록: 날짜·제목만 보이고, 고르면 그 날짜로 이동해 비밀번호를 묻는다 */
export function DiaryList(props: { token: number; current: string; onOpen: (date: string) => void }) {
  const [pages, setPages] = useState(1);
  const [data, setData] = useState<{ key: string; items: DailyReview[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${props.token}#${pages}`;

  useEffect(() => {
    let cancelled = false;
    const [, n] = key.split("#");
    api<DiaryPage>(`/api/daily-reviews/list?page=1&limit=${10 * Number(n)}`)
      .then((r) => {
        if (cancelled) return;
        setData({ key, items: r.items, total: r.total });
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <section className={card} aria-labelledby="d-diary-list">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="d-diary-list" className="text-lg font-bold">
          내 일기
        </h2>
        {data && <span className="text-sm text-gray-600">{data.total}편</span>}
      </div>
      {error && !data ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          일기 목록을 불러오지 못했습니다: {error}
        </p>
      ) : !data ? (
        <p className="mt-2 text-sm text-gray-500">불러오는 중…</p>
      ) : data.items.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">아직 쓴 일기가 없습니다.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-100">
            {data.items.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => props.onOpen(d.review_date)}
                  aria-current={d.review_date === props.current ? "date" : undefined}
                  className={`flex w-full items-baseline gap-3 rounded px-2 py-2 text-left text-sm hover:bg-gray-50 ${d.review_date === props.current ? "bg-blue-50" : ""}`}
                >
                  <span className="w-32 shrink-0 text-gray-500">{formatKoreanDate(d.review_date)}</span>
                  <span className={`min-w-0 flex-1 truncate ${d.title ? "font-medium text-gray-900" : "text-gray-500"}`}>{d.title ?? "(제목 없음)"}</span>
                  <span aria-hidden="true" className="shrink-0 text-xs text-gray-400">
                    🔒
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {data.items.length < data.total && (
            <button type="button" onClick={() => setPages((p) => p + 1)} className="mt-2 text-sm text-gray-600 hover:underline">
              더 보기 ({data.total - data.items.length}편 더)
            </button>
          )}
        </>
      )}
    </section>
  );
}
