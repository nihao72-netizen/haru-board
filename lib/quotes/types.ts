export type Quote = { text: string; author: string; source?: string };

/** 같은 사람·같은 출처의 글귀를 묶어 적는 형식. [문장, 출처]로 출처를 따로 줄 수도 있다 */
export type QuoteGroup = { author: string; source?: string; items: (string | [string, string])[] };

export const flatten = (groups: QuoteGroup[]): Quote[] =>
  groups.flatMap((g) => g.items.map((it) => (typeof it === "string" ? { text: it, author: g.author, source: g.source } : { text: it[0], author: g.author, source: it[1] })));
