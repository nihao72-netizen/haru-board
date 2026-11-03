import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, dbError } from "@/lib/api/http";

export type LearningStatus = "assigned" | "studying" | "completed";

export type HanjaBrief = { id: string; character: string; reading: string; meaning: string };

export type HanjaCharacter = HanjaBrief & {
  explanation: string | null;
  difficulty: number | null;
  sort_order: number;
};

export type HanjaWord = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  /** 이 한자가 단어에서 몇 번째 글자인지 */
  position: number;
  examples: { id: string; sentence: string; explanation: string | null }[];
};

/** 오늘 조회·배정·학습 기록 응답 (PRD 8.10 배정 응답 필드) */
export type LearningRecord = {
  learning_id: string;
  learning_date: string;
  status: LearningStatus;
  completed_at: string | null;
  character: HanjaBrief;
};

export type HanjaDetail = HanjaCharacter & {
  words: HanjaWord[];
  /** 내 학습 기록 (아직 배정되지 않은 글자면 null) */
  learning: { learning_id: string; learning_date: string; status: LearningStatus; completed_at: string | null } | null;
};

export type HanjaProgress = {
  total_characters: number;
  assigned_count: number;
  studying_count: number;
  completed_count: number;
  /** 아직 배정되지 않은 글자 수. 0이면 신규 배정 없음 */
  remaining_count: number;
  first_learning_date: string | null;
  attempts: {
    total: number;
    correct: number;
    incorrect: number;
    daily: number;
    review: number;
    /** 시도가 없으면 null */
    accuracy_rate: number | null;
  };
};

/** hanja_learning + 한자 요약을 한 번에 읽는 select 문 */
export const LEARNING_SELECT =
  "id, learning_date, status, completed_at, hanja_characters!inner(id, character, reading, meaning)";

export type LearningRow = {
  id: string;
  learning_date: string;
  status: LearningStatus;
  completed_at: string | null;
  hanja_characters: HanjaBrief | HanjaBrief[];
};

export function toLearningRecord(row: LearningRow): LearningRecord {
  const c = Array.isArray(row.hanja_characters) ? row.hanja_characters[0] : row.hanja_characters;
  return {
    learning_id: row.id,
    learning_date: row.learning_date,
    status: row.status,
    completed_at: row.completed_at,
    character: { id: c.id, character: c.character, reading: c.reading, meaning: c.meaning },
  };
}

/** 학습 기록 한 건 (RLS로 본인 것만). 없으면 null */
export async function findLearning(supabase: SupabaseClient, column: "id" | "learning_date", value: string) {
  const { data, error } = await supabase.from("hanja_learning").select(LEARNING_SELECT).eq(column, value).maybeSingle();
  if (error) throw dbError(error);
  return data ? toLearningRecord(data as unknown as LearningRow) : null;
}

/** PATCH 본문의 상태. assigned로 되돌리기는 허용하지 않음 */
export function parseLearningStatus(v: unknown): "studying" | "completed" {
  if (v !== "studying" && v !== "completed") {
    throw new ApiError(400, "VALIDATION_ERROR", "status는 studying 또는 completed여야 합니다.");
  }
  return v;
}
