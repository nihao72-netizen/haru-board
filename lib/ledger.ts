import { ApiError } from "@/lib/api/http";
import type { Period } from "@/lib/date";
import { optionalText, requireDate, requireText, requireUuid } from "@/lib/validate";

export type TxType = "income" | "expense";

export type Transaction = {
  id: string;
  category_id: string;
  type: TxType;
  transaction_date: string;
  name: string;
  amount: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type TxCategory = { id: string; type: TxType; name: string; created_at: string };

export type TxSummary = {
  total_income: number;
  total_expense: number;
  balance: number;
  start_date: string;
  end_date: string;
};

export const TX_COLUMNS = "id, category_id, type, transaction_date, name, amount, memo, created_at, updated_at";

/** 금액 상한: 1조 원 (JS 안전 정수 범위 안) */
export const MAX_AMOUNT = 1_000_000_000_000;

export function parseTxType(v: unknown): TxType {
  if (v !== "income" && v !== "expense") {
    throw new ApiError(400, "VALIDATION_ERROR", "type은 income 또는 expense여야 합니다.");
  }
  return v;
}

export function parsePeriod(v: string | null): Period {
  const p = v ?? "month";
  if (p !== "day" && p !== "week" && p !== "month") {
    throw new ApiError(400, "VALIDATION_ERROR", "period는 day, week, month 중 하나여야 합니다.");
  }
  return p;
}

function parseAmount(v: unknown): number {
  const n = typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "금액은 1원 이상의 정수여야 합니다.");
  }
  if (n > MAX_AMOUNT) throw new ApiError(400, "VALIDATION_ERROR", "금액이 너무 큽니다.");
  return n;
}

/** POST /api/transactions 본문 (user_id는 받지 않음) */
export function parseTxCreate(body: Record<string, unknown>) {
  return {
    type: parseTxType(body.type),
    category_id: requireUuid(body.category_id, "분류"),
    transaction_date: requireDate(body.transaction_date, "거래 날짜"),
    name: requireText(body.name, "거래명", 200),
    amount: parseAmount(body.amount),
    memo: optionalText(body.memo, "메모"),
  };
}

/** PATCH /api/transactions/{id} — 보낸 필드만 */
export function parseTxUpdate(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if ("type" in body) patch.type = parseTxType(body.type);
  if ("category_id" in body) patch.category_id = requireUuid(body.category_id, "분류");
  if ("transaction_date" in body) patch.transaction_date = requireDate(body.transaction_date, "거래 날짜");
  if ("name" in body) patch.name = requireText(body.name, "거래명", 200);
  if ("amount" in body) patch.amount = parseAmount(body.amount);
  if ("memo" in body) patch.memo = optionalText(body.memo, "메모");
  if (Object.keys(patch).length === 0) throw new ApiError(400, "VALIDATION_ERROR", "수정할 항목이 없습니다.");
  return patch;
}

export const TX_FK_MESSAGE = "분류가 없거나 거래 유형(수입/지출)과 맞지 않습니다.";
