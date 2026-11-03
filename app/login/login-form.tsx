"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, NoticeBox, SubmitButton, translateAuthError, type Notice } from "@/components/auth-ui";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/env";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const callbackError = searchParams.get("error");

  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(
    callbackError ? { type: "error", text: "인증 링크가 만료되었거나 올바르지 않습니다. 다시 시도하세요." } : null,
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password)
      return setNotice({ type: "error", text: "이메일과 비밀번호를 입력하세요." });

    const supabase = createClient();
    if (!supabase) return setNotice({ type: "error", text: SUPABASE_NOT_CONFIGURED_MESSAGE });

    setPending(true);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);

    if (error) return setNotice({ type: "error", text: translateAuthError(error.message) });

    router.replace(next);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="email" name="email" type="email" label="이메일" autoComplete="email" required />
        <Field
          id="password"
          name="password"
          type="password"
          label="비밀번호"
          autoComplete="current-password"
          required
        />
        <NoticeBox notice={notice} />
        <SubmitButton pending={pending}>로그인</SubmitButton>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-gray-600 sm:flex-row sm:justify-between">
        <Link href="/forgot-password" className="text-blue-600 hover:underline">
          비밀번호를 잊으셨나요?
        </Link>
        <span>
          계정이 없나요?{" "}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline">
            회원가입
          </Link>
        </span>
      </div>
    </>
  );
}
