/**
 * 빠른 추가 입력 해석 (브라우저·서버 공용, 순수 함수)
 * 예) "내일 오후 2시에 하던 프로젝트 최종 점검 p1 #업무"
 *   → { title: "하던 프로젝트 최종 점검", date: 내일, time: "14:00", priority: 1, category: "업무" }
 * 인식한 말(과 붙은 조사)은 제목에서 빠지고, spans로 위치를 돌려줘 입력창에서 강조할 수 있다.
 */

export type TokenKind = "date" | "time" | "priority" | "category";
export type Span = { start: number; end: number; kind: TokenKind };
export type ParseResult = {
  title: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  priority?: 1 | 2 | 3 | 4;
  category?: string;
  spans: Span[];
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 앞은 문장 시작이나 공백, 뒤는 (조사 +) 공백이나 문장 끝
const B = "(?<![^\\s])";
const PARTICLE = "(?:에는|에|까지|부터|엔)?(?=\\s|$)";

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function ymd(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 2월 30일 등
  return dt.toISOString().slice(0, 10);
}
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const pad = (n: number) => String(n).padStart(2, "0");

type Rule = { kind: TokenKind; re: RegExp; value: (m: RegExpExecArray, today: string) => string | number | null };

const RULES: Rule[] = [
  // ── 날짜 ──
  {
    kind: "date",
    re: new RegExp(`${B}(이번\\s?주|다음\\s?주|다다음\\s?주)\\s?([월화수목금토일])요일${PARTICLE}`, "g"),
    value: (m, today) => {
      const weekOffset = m[1].startsWith("다다음") ? 14 : m[1].startsWith("다음") ? 7 : 0;
      const isoToday = dow(today) === 0 ? 7 : dow(today);
      const target = WEEKDAYS.indexOf(m[2]) === 0 ? 7 : WEEKDAYS.indexOf(m[2]);
      return addDays(today, weekOffset + target - isoToday);
    },
  },
  {
    kind: "date",
    re: new RegExp(`${B}([월화수목금토일])요일${PARTICLE}`, "g"),
    value: (m, today) => addDays(today, (WEEKDAYS.indexOf(m[1]) - dow(today) + 7) % 7), // 오늘이 그 요일이면 오늘
  },
  {
    kind: "date",
    re: new RegExp(`${B}(다음\\s?주|다다음\\s?주)${PARTICLE}`, "g"),
    value: (m, today) => {
      const isoToday = dow(today) === 0 ? 7 : dow(today);
      return addDays(today, (m[1].startsWith("다다음") ? 14 : 7) + 1 - isoToday); // 그 주 월요일
    },
  },
  {
    kind: "date",
    re: new RegExp(`${B}(오늘|내일|모레|글피)${PARTICLE}`, "g"),
    value: (m, today) => addDays(today, { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 }[m[1]] ?? 0),
  },
  {
    kind: "date",
    re: new RegExp(`${B}(\\d{4})-(\\d{1,2})-(\\d{1,2})${PARTICLE}`, "g"),
    value: (m) => ymd(Number(m[1]), Number(m[2]), Number(m[3])),
  },
  {
    kind: "date",
    re: new RegExp(`${B}(\\d{1,2})월\\s?(\\d{1,2})일${PARTICLE}`, "g"),
    value: (m, today) => nextMonthDay(today, Number(m[1]), Number(m[2])),
  },
  {
    kind: "date",
    re: new RegExp(`${B}(\\d{1,2})/(\\d{1,2})${PARTICLE}`, "g"),
    value: (m, today) => nextMonthDay(today, Number(m[1]), Number(m[2])),
  },
  {
    kind: "date",
    // '2월 30일'처럼 월이 앞에 있는데 날짜가 잘못된 경우 '30일'만 따로 잡지 않음
    re: new RegExp(`${B}(?<!월\\s)(\\d{1,2})일${PARTICLE}`, "g"),
    value: (m, today) => {
      const y = Number(today.slice(0, 4));
      const mo = Number(today.slice(5, 7));
      const d = Number(m[1]);
      const thisMonth = ymd(y, mo, d);
      if (thisMonth && thisMonth >= today) return thisMonth;
      return mo === 12 ? ymd(y + 1, 1, d) : ymd(y, mo + 1, d);
    },
  },
  // ── 시각 ──
  {
    kind: "time",
    re: new RegExp(`${B}(오전|오후|아침|낮|저녁|밤|새벽)\\s?(\\d{1,2})시(?:\\s?(\\d{1,2})분|\\s?(반))?${PARTICLE}`, "g"),
    value: (m) => {
      let h = Number(m[2]);
      const min = m[4] ? 30 : Number(m[3] ?? 0);
      if (h > 12 || min > 59) return null;
      if (["오후", "저녁", "밤"].includes(m[1]) && h < 12) h += 12;
      else if (m[1] === "낮" && h <= 6) h += 12;
      else if (["오전", "아침", "새벽"].includes(m[1]) && h === 12) h = 0;
      return `${pad(h)}:${pad(min)}`;
    },
  },
  {
    kind: "time",
    re: new RegExp(`${B}([01]?\\d|2[0-3]):([0-5]\\d)${PARTICLE}`, "g"),
    value: (m) => `${pad(Number(m[1]))}:${m[2]}`,
  },
  {
    kind: "time",
    re: new RegExp(`${B}(\\d{1,2})시(?:\\s?(\\d{1,2})분|\\s?(반))?${PARTICLE}`, "g"),
    value: (m) => {
      let h = Number(m[1]);
      const min = m[3] ? 30 : Number(m[2] ?? 0);
      if (h > 24 || min > 59) return null;
      if (h >= 1 && h <= 7) h += 12; // '3시'는 보통 오후 3시
      if (h === 24) h = 0;
      return `${pad(h)}:${pad(min)}`;
    },
  },
  { kind: "time", re: new RegExp(`${B}(정오)${PARTICLE}`, "g"), value: () => "12:00" },
  // ── 우선순위·분류 ──
  { kind: "priority", re: new RegExp(`${B}[pP]([1-4])(?=\\s|$)`, "g"), value: (m) => Number(m[1]) },
  { kind: "category", re: new RegExp(`${B}#([^\\s#@]+)(?=\\s|$)`, "g"), value: (m) => m[1] },
];

function nextMonthDay(today: string, month: number, day: number) {
  const y = Number(today.slice(0, 4));
  const thisYear = ymd(y, month, day);
  if (!thisYear) return null;
  return thisYear >= today ? thisYear : ymd(y + 1, month, day);
}

/**
 * @param disabled 사용자가 칩의 ×로 인식을 취소한 종류 — 그 종류는 해석하지 않고 제목에 남긴다
 */
export function parseQuickAdd(text: string, today: string, disabled: ReadonlySet<TokenKind> = new Set()): ParseResult {
  const result: ParseResult = { title: "", spans: [] };
  const taken: Span[] = [];
  const overlaps = (s: number, e: number) => taken.some((t) => s < t.end && e > t.start);

  for (const rule of RULES) {
    if (disabled.has(rule.kind)) continue;
    // 같은 종류는 처음 인식한 것 하나만 사용
    if (taken.some((t) => t.kind === rule.kind)) continue;
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      const v = rule.value(m, today);
      if (v === null || v === undefined) continue;
      taken.push({ start, end, kind: rule.kind });
      if (rule.kind === "date") result.date = v as string;
      else if (rule.kind === "time") result.time = v as string;
      else if (rule.kind === "priority") result.priority = v as 1 | 2 | 3 | 4;
      else result.category = v as string;
      break;
    }
  }

  taken.sort((a, b) => a.start - b.start);
  result.spans = taken;
  let title = "";
  let pos = 0;
  for (const s of taken) {
    title += text.slice(pos, s.start) + " ";
    pos = s.end;
  }
  title += text.slice(pos);
  result.title = title.replace(/\s+/g, " ").trim();
  return result;
}

/** 날짜 칩·목록 표시용 상대 날짜: 오늘 / 내일 / 어제 / 11월 10일 (월) */
export function relativeDateLabel(date: string, today: string) {
  if (date === today) return "오늘";
  if (date === addDays(today, 1)) return "내일";
  if (date === addDays(today, -1)) return "어제";
  const d = new Date(`${date}T00:00:00Z`);
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return `${sameYear ? "" : `${d.getUTCFullYear()}년 `}${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`;
}

/** 14:00:00 → 오후 2:00 */
export function timeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${pad(m)}`;
}
