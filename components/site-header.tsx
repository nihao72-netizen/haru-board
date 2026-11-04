"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSampleEmail } from "@/lib/sample";
import { ReminderWatcher } from "./reminder-watcher";
import { SampleBanner, SampleButton } from "./sample-ui";

type AuthStatus = "unknown" | "signed_in" | "signed_out";

export function SiteHeader() {
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? "unknown" : "signed_out");
  const [sample, setSample] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "signed_in" : "signed_out");
      setSample(isSampleEmail(data.session?.user.email));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "signed_in" : "signed_out");
      setSample(isSampleEmail(session?.user.email));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 샘플 보기 중 '홈'·로고: 샘플을 끝내고 처음(소개) 화면으로
  const homeClick = async (e: React.MouseEvent) => {
    if (!sample) return;
    e.preventDefault();
    await createClient()?.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const linkClass =
    "shrink-0 whitespace-nowrap rounded px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900";

  return (
    <>
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-3">
        <Link href="/" onClick={homeClick} className="shrink-0 text-lg font-bold text-gray-900">
          하루정리
        </Link>
        {/* 좁은 화면에서는 메뉴가 로고 아래 줄로 내려가고, 필요하면 줄바꿈 */}
        <div className="-ml-2 flex flex-wrap items-center gap-x-1 sm:ml-0 sm:gap-x-2">
          <Link href="/" onClick={homeClick} className={linkClass} title={sample ? "샘플을 끝내고 처음 화면으로" : undefined}>
            홈
          </Link>
          <Link href="/todos" className={linkClass}>
            할 일
          </Link>
          <Link href="/ledger" className={linkClass}>
            가계부
          </Link>
          <Link href="/hanja" className={linkClass}>
            한자
          </Link>
          <Link href="/daily" className={linkClass}>
            하루 마무리
          </Link>
          <Link href="/fortune" className={linkClass}>
            🔮 오늘의 운세
          </Link>
          {status === "signed_in" && (
            <Link href="/account" className={linkClass}>
              내 계정
            </Link>
          )}
          {status === "signed_in" && <ReminderWatcher />}
          {status === "signed_out" && (
            <>
              <Link href="/login" className={`${linkClass} text-blue-700`}>
                로그인
              </Link>
              <SampleButton
                label="👀 샘플 확인"
                className="ml-1 shrink-0 whitespace-nowrap rounded-xl bg-gradient-to-r from-pink-300 via-rose-200 to-yellow-200 px-3 py-1.5 text-sm font-bold text-gray-900 shadow-sm ring-1 ring-pink-300 hover:from-pink-400 hover:to-yellow-300 disabled:opacity-60"
              />
              <Link href="/signup" className="shrink-0 whitespace-nowrap rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
                무료로 시작하기
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
    {status === "signed_in" && sample && <SampleBanner />}
    </>
  );
}
