"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ReminderWatcher } from "./reminder-watcher";

type AuthStatus = "unknown" | "signed_in" | "signed_out";

export function SiteHeader() {
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? "unknown" : "signed_out");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "signed_in" : "signed_out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "signed_in" : "signed_out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const linkClass =
    "shrink-0 whitespace-nowrap rounded px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900";

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold text-gray-900">
          하루정리
        </Link>
        {/* 좁은 화면에서는 메뉴가 로고 아래 줄로 내려가고, 필요하면 줄바꿈 */}
        <div className="-ml-2 flex flex-wrap items-center gap-x-1 sm:ml-0 sm:gap-x-2">
          <Link href="/" className={linkClass}>
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
          {status === "signed_in" && (
            <Link href="/account" className={linkClass}>
              내 계정
            </Link>
          )}
          {status === "signed_in" && <ReminderWatcher />}
          {status === "signed_out" && (
            <Link href="/login" className={`${linkClass} text-blue-700`}>
              로그인
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
