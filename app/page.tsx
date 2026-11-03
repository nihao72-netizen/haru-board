import { Suspense } from "react";
import { HomeDashboard } from "./home-dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">
          하루정리 (Haru Board)
        </h1>

        <p className="mt-4 text-gray-600">
          할 일 · 가계부 · 천자문 학습을 한곳에서 관리합니다.
        </p>

        {/* 로그인하면 오늘의 대시보드, 아니면 소개 카드 (오늘 날짜는 요청 시점 계산이라 Suspense 안에서) */}
        <Suspense fallback={<div className="mt-8 rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>}>
          <HomeDashboard />
        </Suspense>
      </div>
    </main>
  );
}
