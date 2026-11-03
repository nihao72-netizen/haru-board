"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, Field, NoticeBox, SubmitButton, translateAuthError, type Notice } from "@/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/env";

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!email) return setNotice({ type: "error", text: "이메일을 입력하세요." });

    const supabase = createClient();
    if (!supabase) return setNotice({ type: "error", text: SUPABASE_NOT_CONFIGURED_MESSAGE });

    setPending(true);
    setNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setPending(false);

    if (error) return setNotice({ type: "error", text: translateAuthError(error.message) });
    setNotice({
      type: "success",
      text: "재설정 메일 발송을 요청했습니다. 메일함의 링크를 열어 새 비밀번호를 설정하세요.",
    });
  }

  return (
    <AuthCard
      title="비밀번호 재설정"
      description="가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="email" name="email" type="email" label="이메일" autoComplete="email" required />
        <NoticeBox notice={notice} />
        <SubmitButton pending={pending}>재설정 메일 보내기</SubmitButton>
      </form>
      <p className="mt-4 text-xs text-gray-500">
        평가용 환경에서는 메일 발송 설정에 따라 외부 이메일로 메일이 도착하지 않을 수 있습니다.
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-blue-600 hover:underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </AuthCard>
  );
}
