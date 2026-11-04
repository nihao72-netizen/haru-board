"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard, Field, NoticeBox, SubmitButton, type Notice } from "@/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { navigateAfterAuthChange } from "@/lib/auth-navigate";
import { SUPABASE_NOT_CONFIGURED_MESSAGE, isSupabaseConfigured } from "@/lib/supabase/env";

type LoadState =
  | { status: "loading" }
  | { status: "not_configured" }
  | { status: "signed_out" }
  | { status: "ready"; userId: string; email: string; displayName: string; profileError: boolean };

export default function AccountPage() {
  const [state, setState] = useState<LoadState>(
    isSupabaseConfigured ? { status: "loading" } : { status: "not_configured" },
  );
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setState({ status: "signed_out" });
        return;
      }
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = (profile?.display_name as string | null) ?? "";
      setDisplayName(name);
      setState({
        status: "ready",
        userId: user.id,
        email: user.email ?? "",
        displayName: name,
        profileError: Boolean(error) || !profile,
      });
    })();
  }, []);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.status !== "ready") return;
    const trimmed = displayName.trim();
    if (trimmed.length > 50)
      return setNotice({ type: "error", text: "닉네임은 50자 이하로 입력하세요." });

    const supabase = createClient();
    if (!supabase) return setNotice({ type: "error", text: SUPABASE_NOT_CONFIGURED_MESSAGE });

    setSaving(true);
    setNotice(null);
    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed || null })
      .eq("id", state.userId)
      .select("display_name");
    setSaving(false);

    if (error || !data || data.length === 0) {
      return setNotice({ type: "error", text: "닉네임을 저장하지 못했습니다. 잠시 후 다시 시도하세요." });
    }
    setDisplayName(trimmed);
    setNotice({ type: "success", text: "닉네임을 저장했습니다." });
  }

  async function handleSignOut() {
    const supabase = createClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    navigateAfterAuthChange("/login");
  }

  return (
    <AuthCard title="내 계정">
      {state.status === "loading" && <p className="text-sm text-gray-500">계정 정보를 불러오는 중...</p>}

      {state.status === "not_configured" && (
        <NoticeBox notice={{ type: "error", text: SUPABASE_NOT_CONFIGURED_MESSAGE }} />
      )}

      {state.status === "signed_out" && (
        <div className="space-y-4">
          <NoticeBox notice={{ type: "info", text: "로그인이 필요합니다." }} />
          <Link href="/login?next=/account" className="block text-center text-sm text-blue-600 hover:underline">
            로그인하기
          </Link>
        </div>
      )}

      {state.status === "ready" && (
        <div className="space-y-6">
          <dl className="space-y-1">
            <dt className="text-sm font-medium text-gray-500">이메일</dt>
            <dd className="break-all text-gray-900">{state.email}</dd>
          </dl>

          {state.profileError ? (
            <NoticeBox notice={{ type: "error", text: "프로필 정보를 불러올 수 없습니다." }} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4" noValidate>
              <Field
                id="displayName"
                name="displayName"
                type="text"
                label="닉네임"
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                hint="비워 두면 닉네임 없이 표시됩니다."
              />
              <NoticeBox notice={notice} />
              <SubmitButton pending={saving}>닉네임 저장</SubmitButton>
            </form>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full rounded border border-gray-300 px-4 py-2.5 font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-60"
          >
            {signingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      )}
    </AuthCard>
  );
}
