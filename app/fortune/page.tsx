import Link from "next/link";
import { Suspense } from "react";
import { FortuneCard } from "@/components/fortune-card";

export const metadata = { title: "오늘의 운세 | 하루정리" };

export default function FortunePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-blue-600 hover:underline">
          ← 홈으로 돌아가기
        </Link>

        <h1 className="mt-6 text-3xl font-bold">오늘의 운세</h1>

        <p className="mt-2 text-gray-600">띠와 별자리로 보는 오늘 하루. 가볍게 즐기고 좋은 기운만 가져가세요.</p>

        {/* 오늘 날짜(서울 기준)는 요청 시점에 계산하므로 Suspense 경계 안에서 렌더링 */}
        <div className="mt-8">
          <Suspense fallback={<div className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>}>
            <FortuneCard variant="full" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
