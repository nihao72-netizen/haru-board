"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

  const linkClass = "rounded px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900";

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-gray-900">
          하루정리
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/" className={linkClass}>
            홈
          </Link>
          <Link href="/todos" className={linkClass}>
            할 일
          </Link>
          <Link href="/ledger" className={linkClass}>
            가계부
          </Link>
          {status === "signed_in" && (
            <Link href="/account" className={linkClass}>
              내 계정
            </Link>
          )}
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
