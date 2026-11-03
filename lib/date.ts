/** 한국(Asia/Seoul) 기준 날짜 유틸. 서버(Vercel, UTC)와 브라우저 어디서 실행해도 같은 결과. */

const seoulDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 서울 기준 오늘 YYYY-MM-DD */
export function todayKST(now: Date = new Date()): string {
  return seoulDate.format(now);
}

/** YYYY-MM-DD에 일 수 더하기 */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Period = "day" | "week" | "month";

/** 기간 범위 (양 끝 포함). 주는 월~일, 월은 1일~말일 (PRD 4.3) */
export function periodRange(period: Period, date: string): { start: string; end: string } {
  const d = new Date(`${date}T00:00:00Z`);
  if (period === "day") return { start: date, end: date };
  if (period === "week") {
    const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 월=1 … 일=7
    const start = addDays(date, 1 - isoDow);
    return { start, end: addDays(start, 6) };
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** 화면 표시용: 2026-11-03 → 11월 3일 (화) */
export function formatKoreanDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${w})`;
}
