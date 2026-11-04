"use client";

import Link from "next/link";
import { useState } from "react";
import { SampleButton } from "@/components/sample-ui";

/**
 * 로그인 전 소개 화면 (design.md 4장)
 * 히어로(실제 화면을 본뜬 목업) → 기능 카드 4개 → 체험용 데모 목록 → 마지막 안내 → 바닥글
 * 실제 데이터·후기·통계는 보여 주지 않는다.
 */

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-2.5 text-base font-semibold text-gray-800 ring-1 ring-gray-200 hover:bg-gray-100";

/** 히어로 오른쪽 목업: 오늘 화면의 축소판 (정적) */
function HeroMockup() {
  const tasks = [
    { title: "프로젝트 일정 정리하기", meta: "오후 2:00", done: true },
    { title: "장보기", meta: "# 일상", done: true },
    { title: "영어 단어 30개 외우기", meta: "P1", done: false, p1: true },
    { title: "오늘의 한자 퀴즈 풀기", meta: "# 공부", done: false },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div aria-hidden="true" className="absolute -left-6 -top-6 h-40 w-40 rounded-full bg-blush blur-2xl" />
      <div aria-hidden="true" className="absolute -bottom-8 -right-4 h-44 w-44 rounded-full bg-lavender blur-2xl" />
      <div className="relative rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-200" aria-label="앱 화면 예시">
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-bold">오늘의 할 일</p>
          <p className="text-xs text-gray-500">11월 4일 · 수요일</p>
        </div>
        <div className="mt-3 flex items-baseline justify-between text-xs text-gray-600">
          <span>진행률</span>
          <span>
            <b className="text-gray-900">2</b> / 4 완료
          </span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-gray-100">
          <div className="h-full w-1/2 rounded-full bg-blue-600" />
        </div>
        <ul className="mt-3 divide-y divide-gray-100">
          {tasks.map((t) => (
            <li key={t.title} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                aria-hidden="true"
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 text-[11px] ${t.done ? "border-success bg-success text-white" : t.p1 ? "border-red-600" : "border-gray-400"}`}
              >
                {t.done && "✓"}
              </span>
              <span className={`flex-1 ${t.done ? "text-gray-500 line-through" : "text-gray-900"}`}>{t.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${t.p1 ? "bg-red-50 font-semibold text-red-700" : "bg-gray-100 text-gray-600"}`}>{t.meta}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-400">무엇을 해야 하나요?</div>
        <div className="mt-2 flex gap-1.5 text-xs">
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">📅 내일 오후 2:00</span>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">P1</span>
          <span className="rounded-full bg-lavender px-2 py-0.5 text-lavender-deep"># 업무</span>
        </div>
      </div>
    </div>
  );
}

const FEATURES: { title: string; body: string; visual: React.ReactNode }[] = [
  {
    title: "빠른 할 일 추가",
    body: "‘내일 오후 2시 보고서 p1 #업무’처럼 한 줄로 적으면 날짜·시각·우선순위·분류를 알아서 정리해요. 제목만 적어도 충분해요.",
    visual: (
      <div className="rounded-xl bg-white p-3 text-xs ring-1 ring-gray-200">
        <p className="text-gray-800">
          <mark className="rounded bg-blue-50 px-0.5 text-blue-700">내일 오후 2시</mark> 보고서 점검 <mark className="rounded bg-red-50 px-0.5 text-red-700">p1</mark>{" "}
          <mark className="rounded bg-lavender px-0.5 text-lavender-deep">#업무</mark>
        </p>
      </div>
    ),
  },
  {
    title: "가계부와 예산",
    body: "수입·지출을 기록하고 이번 달 예산을 얼마나 썼는지 한눈에 봐요. 80%를 넘으면 차분하게 알려 드려요.",
    visual: (
      <div className="rounded-xl bg-white p-3 text-xs ring-1 ring-gray-200">
        <div className="flex justify-between text-gray-600">
          <span>11월 식비</span>
          <span>
            <b className="text-gray-900">82%</b> · ▲ 주의
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-gray-100">
          <div className="h-full w-[82%] rounded-full bg-amber-500" />
        </div>
      </div>
    ),
  },
  {
    title: "하루 한 글자 한자",
    body: "천자문 순서로 매일 한 글자를 배우고 퀴즈로 확인해요. 틀린 문제는 다음 주 월요일에 다시 복습해요.",
    visual: (
      <div className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-gray-200">
        <span className="font-serif text-3xl" lang="zh-Hant">
          天
        </span>
        <span className="text-xs text-gray-600">
          하늘 천<span className="mt-0.5 block text-success">✓ 오늘의 퀴즈 정답</span>
        </span>
      </div>
    ),
  },
  {
    title: "하루 마무리 일기",
    body: "그날의 할 일·지출·공부 기록을 모아 보고 일기를 남겨요. 일기 내용은 비밀번호를 한 번 더 확인해야 열려요.",
    visual: (
      <div className="rounded-xl bg-white p-3 text-xs ring-1 ring-gray-200">
        <p className="font-medium text-gray-900">가을 산책</p>
        <p className="mt-0.5 text-gray-500">🔒 일기 내용은 잠겨 있어요</p>
      </div>
    ),
  },
];

const DEMO = ["물 한 잔 마시기", "오늘 일정 확인하기", "점심값 가계부에 적기", "오늘의 한자 퀴즈 풀기", "일기 세 줄 쓰기"];

/** 체험용 목록: 눌러 보면 진행률이 바뀐다. 저장하지 않는다 */
function DemoChecklist() {
  const [done, setDone] = useState<boolean[]>([true, false, false, false, false]);
  const count = done.filter(Boolean).length;
  const percent = Math.round((count / DEMO.length) * 100);
  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-5 shadow ring-1 ring-gray-200 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-bold">오늘의 할 일</p>
        <span className="rounded-full bg-lavender px-2 py-0.5 text-xs font-medium text-lavender-deep">데모 · 저장되지 않아요</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between text-sm text-gray-600">
        <span>진행률</span>
        <span aria-live="polite">
          <b className="text-gray-900">{count}</b> / {DEMO.length} 완료
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={DEMO.length} aria-valuenow={count} aria-label="데모 진행률">
        <div className="progress-fill h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-3">
        {DEMO.map((title, i) => (
          <li key={title}>
            <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={done[i]}
                onChange={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
                className="h-5 w-5 shrink-0 accent-[#23724e]"
              />
              <span className={done[i] ? "text-gray-500 line-through" : "text-gray-900"}>{title}</span>
            </label>
          </li>
        ))}
      </ul>
      {count === DEMO.length && <p className="mt-2 rounded-lg bg-mint px-3 py-2 text-sm text-success">오늘의 할 일을 모두 마쳤어요. 수고했어요!</p>}
    </div>
  );
}

export function Landing() {
  return (
    <div className="mt-2">
      {/* 히어로 */}
      <section className="grid items-center gap-10 py-8 sm:py-12 lg:grid-cols-2" aria-labelledby="hero-title">
        <div>
          <p className="text-sm font-semibold tracking-wide text-blue-700">매일을 가볍게</p>
          <h1 id="hero-title" className="mt-3 text-[34px] font-bold leading-tight tracking-[-0.035em] text-gray-900 sm:text-5xl sm:leading-[1.15]">
            오늘 하루를,
            <br />더 가볍게.
          </h1>
          <p className="mt-5 max-w-md text-lg text-gray-600">
            할 일·가계부·한자 공부·일기를 한곳에 빠르게 기록하고, 중요한 일에 집중하세요.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={primaryButton}>
              무료로 시작하기
            </Link>
            <SampleButton className={secondaryButton} label="샘플 확인" />
          </div>
          <p className="mt-3 text-sm text-gray-500">
            <b className="font-medium text-gray-700">샘플 확인</b>은 가입 없이 예시 데이터로 채워진 화면을 둘러보는 보기 전용 모드예요.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            <a href="#preview" className="font-medium text-blue-700 underline-offset-2 hover:underline">
              앱 미리보기
            </a>
            {" · "}이미 계정이 있나요?{" "}
            <Link href="/login" className="font-medium text-blue-700 underline-offset-2 hover:underline">
              로그인
            </Link>
          </p>
        </div>
        <HeroMockup />
      </section>

      {/* 기능 */}
      <section className="py-10" aria-labelledby="features-title">
        <h2 id="features-title" className="text-2xl font-semibold sm:text-[28px]">
          하루를 정리하는 네 가지
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-2xl bg-gray-100 p-5 ring-1 ring-gray-200 sm:p-6">
              {f.visual}
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-[15px] text-gray-600">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 체험 */}
      <section id="preview" className="scroll-mt-6 py-10" aria-labelledby="preview-title">
        <h2 id="preview-title" className="text-center text-2xl font-semibold sm:text-[28px]">
          직접 눌러 보세요
        </h2>
        <p className="mt-2 text-center text-gray-600">체크하면 진행률이 바로 바뀌어요. 로그인하지 않아도 돼요.</p>
        <div className="mt-6">
          <DemoChecklist />
        </div>
      </section>

      {/* 마지막 안내 */}
      <section className="my-10 rounded-2xl bg-blue-50 px-6 py-10 text-center ring-1 ring-blue-100" aria-labelledby="cta-title">
        <h2 id="cta-title" className="text-2xl font-semibold">
          첫 번째 할 일을 지금 만들어 보세요.
        </h2>
        <p className="mt-2 text-gray-600">이메일만 있으면 바로 시작할 수 있어요.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={primaryButton}>
            무료로 시작하기
          </Link>
          <SampleButton className={secondaryButton} label="먼저 샘플 둘러보기" />
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 text-sm text-gray-500">
        <p className="font-semibold text-gray-800">하루정리</p>
        <p className="mt-1">할 일·가계부·한자·일기를 한곳에서 정리하는 개인 대시보드</p>
        <p className="mt-3">
          <a href="https://github.com/nihao72-netizen/haru-board" className="underline-offset-2 hover:underline">
            GitHub
          </a>{" "}
          · © 2026 하루정리
        </p>
      </footer>
    </div>
  );
}
