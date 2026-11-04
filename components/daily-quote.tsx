"use client";

import { useEffect, useState } from "react";
import { QUOTES, quoteIndexFor } from "@/lib/quotes";
import { createClient } from "@/lib/supabase/client";

const storeKey = (seed: string) => `haru:quote:${seed}`;

/**
 * 오늘의 글귀: 로그인할 때마다 다른 명언. 같은 로그인 동안은 새로고침해도 같은 글귀이고,
 * '다른 글귀'를 누르면 바꾼 글귀가 이번 로그인 동안 유지된다.
 */
export function DailyQuote() {
  const [state, setState] = useState<{ seed: string; index: number } | null>(null);

  useEffect(() => {
    createClient()
      ?.auth.getUser()
      .then(({ data }) => {
        const user = data.user;
        if (!user) return;
        const seed = `${user.id}:${user.last_sign_in_at ?? ""}`;
        let index = quoteIndexFor(seed);
        try {
          const saved = sessionStorage.getItem(storeKey(seed));
          if (saved !== null && Number(saved) >= 0 && Number(saved) < QUOTES.length) index = Number(saved);
        } catch {}
        setState({ seed, index });
      });
  }, []);

  if (!state) return null;
  const q = QUOTES[state.index];

  function next() {
    setState((s) => {
      if (!s) return s;
      // 지금 글귀와 다른 것으로 (작가도 가능하면 다르게)
      let n = s.index;
      for (let tries = 0; tries < 10 && (n === s.index || QUOTES[n].author === QUOTES[s.index].author); tries++) {
        n = Math.floor(Math.random() * QUOTES.length);
      }
      try {
        sessionStorage.setItem(storeKey(s.seed), String(n));
      } catch {}
      return { ...s, index: n };
    });
  }

  return (
    <figure
      aria-label="오늘의 글귀"
      className="relative max-w-xl rounded-2xl bg-gradient-to-br from-blush/70 via-white to-lavender/70 px-5 py-4 ring-1 ring-pink-100 lg:mt-1 lg:max-w-md"
    >
      <blockquote aria-live="polite" className="pr-2 text-[15px] font-medium leading-relaxed text-gray-800">
        <span aria-hidden="true" className="mr-1 text-lg">
          💬
        </span>
        “{q.text}”
      </blockquote>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-lavender-deep">
          — {q.author}
          {q.source && <span className="ml-1 font-normal text-gray-500">({q.source})</span>}
        </span>
        <button
          type="button"
          onClick={next}
          className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-blush-deep ring-1 ring-pink-200 hover:bg-white"
        >
          ↻ 다른 글귀
        </button>
      </figcaption>
    </figure>
  );
}
