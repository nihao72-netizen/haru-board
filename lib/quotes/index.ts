// 홈 '오늘의 글귀' 전체 목록 (동서양 명언). 같은 문장은 한 번만 넣는다.
// 출처를 확인할 수 있는 말만 모았고, 문장은 번역본을 베끼지 않고 직접 옮긴 표현이다.
import { BASE } from "./base";
import { EAST } from "./east";
import { FAITH } from "./faith";
import { KOREA } from "./korea";
import { MORE } from "./more";
import type { Quote } from "./types";
import { WEST } from "./west";

export type { Quote } from "./types";

const seen = new Set<string>();
export const QUOTES: Quote[] = [...BASE, ...EAST, ...FAITH, ...WEST, ...KOREA, ...MORE].filter((q) => {
  const key = q.text.replace(/\s/g, "");
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

/** 로그인 시각(같은 로그인 동안은 같은 값)으로 글귀 번호를 정한다 */
export function quoteIndexFor(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Math.abs(h) % QUOTES.length;
}
