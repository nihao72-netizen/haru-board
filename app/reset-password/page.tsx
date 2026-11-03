"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard, Field, NoticeBox, SubmitButton, translateAuthError, type Notice } from "@/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_NOT_CONFIGURED_MESSAGE, isSupabaseConfigured } from "@/lib/supabase/env";

type SessionState = "checking" | "valid" | "missing" | "not_configured";

export default function ResetPasswordPage() {
  const [sessionState, setSessionState] = useState<SessionState>(
    isSupabaseConfigured ? "checking" : "not_configured",
  );
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    // 재설정 링크 → /auth/callback에서 세션 교환 후 이 페이지로 온다. 서버에서 세션을 검증한다.
    supabase.auth.getUser().then(({ data }) => {
      setSessionState(data.user ? "valid" : "missing");
    });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirm = String(form.get("passwordConfirm") ?? "");

    if (password.length < 6)
      return setNotice({ type: "error", text: "비밀번호는 6자 이상이어야 합니다." });
    if (password !== passwordConfirm)
      return setNotice({ type: "error", text: "비밀번호와 비밀번호 확인이 일치하지 않습니다." });

    const supabase = createClient();
    if (!supabase) return setNotice({ type: "error", text: SUPABASE_NOT_CONFIGURED_MESSAGE });

    setPending(true);
    setNotice(null);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) return setNotice({ type: "error", text: translateAuthError(error.message) });
    setDone(true);
    setNotice({ type: "success", text: "비밀번호가 변경되었습니다." });
  }

  return (
    <AuthCard title="새 비밀번호 설정">
      {sessionState === "checking" && <p className="text-sm text-gray-500">재설정 링크를 확인하는 중...</p>}

      {sessionState === "not_configured" && (
        <NoticeBox notice={{ type: "error", text: SUPABASE_NOT_CONFIGURED_MESSAGE }} />
      )}

      {sessionState === "missing" && (
        <div className="space-y-4">
          <NoticeBox
            notice={{
              type: "error",
              text: "재설정 링크가 만료되었거나 유효하지 않습니다. 재설정 메일을 다시 요청하세요.",
            }}
          />
          <Link href="/forgot-password" className="block text-center text-sm text-blue-600 hover:underline">
            비밀번호 재설정 다시 요청하기
          </Link>
        </div>
      )}

      {sessionState === "valid" && !done && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field
            id="password"
            name="password"
            type="password"
            label="새 비밀번호"
            autoComplete="new-password"
            hint="6자 이상"
            required
          />
          <Field
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            label="새 비밀번호 확인"
            autoComplete="new-password"
            required
          />
          <NoticeBox notice={notice} />
          <SubmitButton pending={pending}>비밀번호 변경</SubmitButton>
        </form>
      )}

      {done && (
        <div className="space-y-4">
          <NoticeBox notice={notice} />
          <Link href="/" className="block text-center text-sm font-medium text-blue-600 hover:underline">
            홈으로 이동
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
