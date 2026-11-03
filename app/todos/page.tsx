import Link from "next/link";
import { Suspense } from "react";
import { TodoApp } from "./todo-app";

export default function TodosPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-blue-600 hover:underline">
          ← 홈으로 돌아가기
        </Link>

        <h1 className="mt-6 text-3xl font-bold">
          할 일 관리
        </h1>

        <p className="mt-2 text-gray-600">
          오늘 해야 할 일과 메모를 기록합니다.
        </p>

        {/* 오늘 날짜(서울 기준)와 주소의 보기 상태는 요청 시점에 정해지므로 Suspense 경계 안에서 렌더링 */}
        <Suspense fallback={<div className="mt-8 rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>}>
          <TodoApp />
        </Suspense>
      </div>
    </main>
  );
}
