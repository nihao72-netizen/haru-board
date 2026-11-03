import Link from "next/link";
import { Suspense } from "react";
import { DailyBoard } from "./daily-board";

export default function DailyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-blue-600 hover:underline">
          ← 홈으로 돌아가기
        </Link>

        <h1 className="mt-6 text-3xl font-bold">하루 마무리</h1>

        <p className="mt-2 text-gray-600">하루 동안 남긴 기록을 모아 보고, 자유롭게 일기를 씁니다.</p>

        {/* 오늘 날짜(서울 기준)는 요청 시점에 계산해야 하므로 Suspense 경계 안에서 렌더링 */}
        <Suspense fallback={<div className="mt-8 rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>}>
          <DailyBoard />
        </Suspense>
      </div>
    </main>
  );
}
