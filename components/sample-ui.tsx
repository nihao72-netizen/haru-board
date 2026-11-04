"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SAMPLE_EMAIL, SAMPLE_PASSWORD } from "@/lib/sample";
import { createClient } from "@/lib/supabase/client";

/** "샘플 확인": 보기 전용 샘플 계정으로 로그인해 홈으로 이동 */
export function SampleButton(props: { className?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const supabase = createClient();
    if (!supabase) return setError("Supabase 설정이 없습니다.");
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: SAMPLE_EMAIL, password: SAMPLE_PASSWORD });
    if (e) {
      setBusy(false);
      return setError(e.status === 429 ? "요청이 많아요. 잠시 후 다시 시도해 주세요." : "샘플을 열지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    // 헤더·홈 대시보드는 로그인 상태 변경 이벤트를 받아 다시 그려진다
    router.push("/");
    router.refresh();
    setBusy(false);
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={start} disabled={busy} className={props.className}>
        {busy ? "샘플 여는 중…" : (props.label ?? "샘플 확인")}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}

/** 샘플 보기 중 안내 띠: 모든 화면 위. '내 계정 만들기'는 로그아웃 후 회원가입으로 */
export function SampleBanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  /** 샘플을 끝내고(로그아웃) 이동 */
  async function leave(to: "/" | "/signup") {
    setBusy(true);
    await createClient()?.auth.signOut();
    router.push(to);
    router.refresh();
  }
  return (
    <div role="status" className="border-b border-lavender bg-lavender/60">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <p className="text-lavender-deep">
          <span aria-hidden="true">👀 </span>
          <b>샘플 보기 중이에요.</b> 둘러볼 수만 있고 내용은 바꿀 수 없어요.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => leave("/")}
            disabled={busy}
            className="rounded-xl bg-white px-3 py-1 text-sm font-semibold text-lavender-deep ring-1 ring-purple-200 hover:bg-purple-50 disabled:opacity-60"
          >
            처음 화면으로
          </button>
          <button
            type="button"
            onClick={() => leave("/signup")}
            disabled={busy}
            className="rounded-xl bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "이동 중…" : "내 계정 만들고 시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
