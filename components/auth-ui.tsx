import type { InputHTMLAttributes, ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-start justify-center bg-gray-50 px-4 py-10 sm:py-16">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function Field({
  label,
  hint,
  id,
  ...inputProps
}: { label: string; hint?: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {label}
        {inputProps.required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <input
        id={id}
        className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        {...inputProps}
      />
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "처리 중..." : children}
    </button>
  );
}

export type Notice = { type: "error" | "success" | "info"; text: string } | null;

export function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  }[notice.type];
  const label = { error: "오류", success: "완료", info: "안내" }[notice.type];
  return (
    <div role={notice.type === "error" ? "alert" : "status"} className={`rounded border px-3 py-2 text-sm ${styles}`}>
      <span className="font-semibold">{label}: </span>
      {notice.text}
    </div>
  );
}

/** Supabase Auth 오류 메시지를 한국어로 변환 */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "이미 가입된 이메일입니다.";
  if (m.includes("password should be at least")) return "비밀번호는 6자 이상이어야 합니다.";
  if (m.includes("email not confirmed")) return "이메일 인증이 완료되지 않았습니다.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "이메일 형식이 올바르지 않습니다.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "요청이 너무 많습니다. 잠시 후 다시 시도하세요.";
  if (m.includes("same password") || m.includes("different from the old"))
    return "새 비밀번호는 기존 비밀번호와 달라야 합니다.";
  if (m.includes("auth session missing")) return "로그인 세션이 없습니다. 다시 시도하세요.";
  return `요청을 처리하지 못했습니다. (${message})`;
}
