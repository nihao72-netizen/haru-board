"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { todayKST } from "@/lib/date";
import { fortuneFor, validBirth, type Fortune } from "@/lib/fortune";
import { createClient } from "@/lib/supabase/client";

const keyFor = (userId: string) => `haru:birth:${userId}`;

function Stars({ n, label }: { n: number; label: string }) {
  return (
    <span role="img" aria-label={`${label} 5점 중 ${n}점`} className="whitespace-nowrap tracking-tight">
      <span className="text-amber-500">{"★".repeat(n)}</span>
      <span className="text-gray-300">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/** 생년월일(이 기기에 저장)과 오늘 날짜로 운세를 보여 준다. compact: 홈 카드, full: 운세 화면 */
export function FortuneCard({ variant }: { variant: "compact" | "full" }) {
  const today = todayKST();
  const [user, setUser] = useState<string | null>(null);
  const [birth, setBirth] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      ?.auth.getUser()
      .then(({ data }) => {
        const id = data.user?.id ?? "guest";
        setUser(id);
        try {
          const saved = localStorage.getItem(keyFor(id));
          if (saved && validBirth(saved, todayKST())) setBirth(saved);
        } catch {}
      });
  }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validBirth(input, today)) return setError("생년월일을 올바르게 입력해 주세요.");
    try {
      if (user) localStorage.setItem(keyFor(user), input);
    } catch {}
    setBirth(input);
    setEditing(false);
    setError(null);
  }

  const card = variant === "compact" ? "rounded-lg p-4 shadow sm:p-6" : "rounded-2xl p-5 shadow sm:p-8";
  const shell = `${card} bg-gradient-to-br from-lavender/60 via-white to-blush/50 ring-1 ring-purple-100`;
  if (!user) return <section className={shell} aria-busy="true" aria-label="오늘의 운세 불러오는 중" />;

  if (!birth || editing) {
    return (
      <section aria-labelledby={`fortune-${variant}`} className={shell}>
        <h2 id={`fortune-${variant}`} className={variant === "compact" ? "font-bold" : "text-xl font-bold"}>
          🔮 오늘의 운세
        </h2>
        <p className="mt-2 text-sm text-gray-700">생년월일을 입력하면 띠와 별자리에 맞춘 오늘의 운세를 볼 수 있어요.</p>
        <form onSubmit={save} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={`birth-${variant}`} className="sr-only">
            생년월일
          </label>
          <input
            id={`birth-${variant}`}
            type="date"
            min="1900-01-01"
            max={today}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
            운세 보기
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:underline">
              취소
            </button>
          )}
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">생년월일은 이 기기(브라우저)에만 저장되고 서버로 보내지 않아요.</p>
      </section>
    );
  }

  const f: Fortune = fortuneFor(birth, today);
  const [, mm, dd] = today.split("-").map(Number);
  return (
    <section aria-labelledby={`fortune-${variant}`} className={shell}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`fortune-${variant}`} className={variant === "compact" ? "font-bold" : "text-xl font-bold"}>
          🔮 오늘의 운세 <span className="text-sm font-normal text-gray-500">{mm}월 {dd}일</span>
        </h2>
        <span className="text-xs text-gray-600">
          {f.animal.emoji} {f.animal.name}띠 · {f.sign.symbol} {f.sign.name}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-2">
        <span className="shrink-0 text-sm font-semibold text-gray-800">총운</span>
        <Stars n={f.total.stars} label="총운" />
      </div>
      <p className={`mt-1 text-gray-800 ${variant === "compact" ? "text-sm" : "text-base"}`}>{f.total.text}</p>

      {variant === "full" && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {f.categories.map((c) => (
            <li key={c.key} className="rounded-xl bg-white/70 p-3 ring-1 ring-gray-100">
              <div className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-800">
                {c.label}운 <Stars n={c.stars} label={`${c.label}운`} />
              </div>
              <p className="mt-1 text-sm text-gray-700">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      <dl className={`mt-3 grid gap-x-4 gap-y-1 text-xs text-gray-700 ${variant === "full" ? "mt-5 grid-cols-2 text-sm sm:grid-cols-4" : "grid-cols-2"}`}>
        <div className="flex items-center gap-1.5">
          <dt className="text-gray-500">행운의 색</dt>
          <dd className="flex items-center gap-1 font-medium">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full ring-1 ring-gray-300" style={{ background: f.lucky.color.hex }} />
            {f.lucky.color.name}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-gray-500">행운의 숫자</dt>
          <dd className="font-medium">{f.lucky.number}</dd>
        </div>
        {variant === "full" && (
          <>
            <div className="flex gap-1.5">
              <dt className="text-gray-500">행운의 방향</dt>
              <dd className="font-medium">{f.lucky.direction}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-gray-500">행운의 물건</dt>
              <dd className="font-medium">{f.lucky.item}</dd>
            </div>
          </>
        )}
      </dl>

      {variant === "full" && <p className="mt-5 rounded-xl bg-white/70 p-3 text-sm text-gray-800 ring-1 ring-gray-100">💡 오늘의 한마디: {f.advice}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-gray-500">재미로 보는 운세예요.</span>
        <span className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setInput(birth);
              setEditing(true);
            }}
            className="text-gray-500 hover:underline"
          >
            생년월일 바꾸기
          </button>
          {variant === "compact" && (
            <Link href="/fortune" className="font-semibold text-lavender-deep hover:underline">
              자세히 보기 →
            </Link>
          )}
        </span>
      </div>
      {variant === "full" && f.animal && <p className="mt-2 text-[11px] text-gray-400">띠는 양력 연도 기준이라 1~2월(설날 전) 생은 실제 띠와 다를 수 있어요.</p>}
    </section>
  );
}
