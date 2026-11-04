import { Suspense } from "react";
import { AuthCard } from "@/components/auth-ui";
import { SampleButton } from "@/components/sample-ui";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthCard title="로그인" description="이메일과 비밀번호로 로그인하세요.">
      {/* useSearchParams를 쓰는 폼은 cacheComponents 환경에서 Suspense 안에 둔다 */}
      <Suspense fallback={<p className="text-sm text-gray-500">불러오는 중...</p>}>
        <LoginForm />
      </Suspense>
      <div className="mt-6 border-t border-gray-200 pt-4 text-center text-sm text-gray-600">
        <p>계정 없이 먼저 둘러보고 싶다면</p>
        <SampleButton
          label="샘플 확인 (보기 전용)"
          className="mt-2 min-h-11 rounded-xl bg-white px-4 py-2 font-semibold text-gray-800 ring-1 ring-gray-200 hover:bg-gray-100"
        />
      </div>
    </AuthCard>
  );
}
