import { Suspense } from "react";
import { AuthCard } from "@/components/auth-ui";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthCard title="로그인" description="이메일과 비밀번호로 로그인하세요.">
      {/* useSearchParams를 쓰는 폼은 cacheComponents 환경에서 Suspense 안에 둔다 */}
      <Suspense fallback={<p className="text-sm text-gray-500">불러오는 중...</p>}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
