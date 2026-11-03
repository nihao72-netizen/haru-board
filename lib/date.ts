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

/** YYYY-MM 형식이며 실제 존재하는 월인지 */
export function isMonthString(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}$/.test(v)) return false;
  const m = Number(v.slice(5, 7));
  return m >= 1 && m <= 12 && Number(v.slice(0, 4)) >= 1;
}

/** YYYY-MM에 개월 수 더하기 */
export function shiftMonth(month: string, n: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** YYYY-MM → 그 달 1일과 말일 */
export function monthRange(month: string): { start: string; end: string } {
  return periodRange("month", `${month}-01`);
}

/** 화면 표시용: 2026-11 → 2026년 11월 */
export function formatKoreanMonth(month: string): string {
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
}

/** 화면 표시용: 2026-11-03 → 11월 3일 (화) */
export function formatKoreanDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${w})`;
}
