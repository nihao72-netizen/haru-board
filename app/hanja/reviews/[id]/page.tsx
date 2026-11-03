import Link from "next/link";
import { Suspense } from "react";
import { ReviewSession } from "./review-session";

export default function ReviewPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/hanja" className="text-blue-600 hover:underline">
          ← 오늘의 한자로 돌아가기
        </Link>

        <h1 className="mt-6 text-3xl font-bold">오답 복습</h1>

        <p className="mt-2 text-gray-600">지난주에 틀린 문제를 다시 풀어 봅니다. 한 문제는 한 번만 제출할 수 있습니다.</p>

        <Suspense fallback={<div className="mt-8 rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>}>
          <ReviewSession />
        </Suspense>
      </div>
    </main>
  );
}
