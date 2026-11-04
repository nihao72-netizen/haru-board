"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, Field, NoticeBox, SubmitButton, translateAuthError, type Notice } from "@/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { navigateAfterAuthChange } from "@/lib/auth-navigate";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/env";

export default function SignupPage() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const passwordConfirm = String(form.get("passwordConfirm") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();

    if (!email) return setNotice({ type: "error", text: "이메일을 입력하세요." });
    if (password.length < 6)
      return setNotice({ type: "error", text: "비밀번호는 6자 이상이어야 합니다." });
    if (password !== passwordConfirm)
      return setNotice({ type: "error", text: "비밀번호와 비밀번호 확인이 일치하지 않습니다." });
    if (displayName.length > 50)
      return setNotice({ type: "error", text: "닉네임은 50자 이하로 입력하세요." });

    const supabase = createClient();
    if (!supabase) return setNotice({ type: "error", text: SUPABASE_NOT_CONFIGURED_MESSAGE });

    setPending(true);
    setNotice(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: displayName ? { data: { display_name: displayName } } : undefined,
    });
    setPending(false);

    if (error) return setNotice({ type: "error", text: translateAuthError(error.message) });

    if (data.session) {
      navigateAfterAuthChange("/");
      return;
    }
    setNotice({ type: "info", text: "가입 확인 메일을 확인하세요." });
  }

  return (
    <AuthCard title="회원가입" description="이메일과 비밀번호로 하루정리를 시작하세요.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="email" name="email" type="email" label="이메일" autoComplete="email" required />
        <Field
          id="password"
          name="password"
          type="password"
          label="비밀번호"
          autoComplete="new-password"
          hint="6자 이상"
          required
        />
        <Field
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          label="비밀번호 확인"
          autoComplete="new-password"
          required
        />
        <Field id="displayName" name="displayName" type="text" label="닉네임 (선택)" maxLength={50} />
        <NoticeBox notice={notice} />
        <SubmitButton pending={pending}>가입하기</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          로그인
        </Link>
      </p>
    </AuthCard>
  );
}
