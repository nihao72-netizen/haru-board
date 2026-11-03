
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <h1 className="text-3xl font-bold">
        하루정리 (Haru Board)
      </h1>

      <p className="mt-4 text-gray-600">
        할 일 · 가계부 · 천자문 학습을 한곳에서 관리합니다.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold">할 일</h2>
          <p>오늘 해야 할 일을 관리합니다.</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold">가계부</h2>
          <p>매일의 지출을 기록합니다.</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-bold">천자문</h2>
          <p>한자를 공부하고 복습합니다.</p>
        </div>
      </div>
    </main>
  );
}
