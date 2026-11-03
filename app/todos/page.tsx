
import Link from "next/link";

export default function TodosPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <Link href="/" className="text-blue-600 hover:underline">
        ← 홈으로 돌아가기
      </Link>

      <h1 className="mt-6 text-3xl font-bold">
        할 일 관리
      </h1>

      <p className="mt-2 text-gray-600">
        오늘 해야 할 일을 기록합니다.
      </p>

      <div className="mt-8 rounded-lg bg-white p-6 shadow">
        <input
          type="text"
          placeholder="할 일을 입력하세요"
          className="w-full rounded border p-3"
        />

        <button className="mt-4 rounded bg-blue-600 px-5 py-3 text-white">
          추가하기
        </button>
      </div>
    </main>
  );
}
