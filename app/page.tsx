import { Suspense } from "react";
import { DailyQuote } from "@/components/daily-quote";
import { HomeDashboard } from "./home-dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:p-10">
      <div className="mx-auto max-w-5xl">
        {/* 로그인하면 제목 + 오늘의 대시보드, 아니면 소개(랜딩) 화면 (오늘 날짜는 요청 시점 계산이라 Suspense 안에서) */}
        <Suspense fallback={<div className="mt-8 rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>}>
          <HomeDashboard
            header={
              /* 제목 옆(좁은 화면에서는 아래)에 로그인할 때마다 바뀌는 오늘의 글귀 */
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-3xl font-bold">
                    하루정리 (Haru Board)
                  </h1>

                  <p className="mt-4 text-gray-600">
                    할 일 · 가계부 · 천자문 학습을 한곳에서 관리합니다.
                  </p>
                </div>
                <DailyQuote />
              </div>
            }
          />
        </Suspense>
      </div>
    </main>
  );
}
