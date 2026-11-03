import type { NextRequest } from "next/server";
import { ApiError, dbError, handle, ok, requireUser } from "@/lib/api/http";
import type { HanjaDetail, HanjaWord, LearningStatus } from "@/lib/hanja";
import { requireUuid } from "@/lib/validate";

type WordLinkRow = {
  position: number;
  hanja_words: {
    id: string;
    word: string;
    reading: string;
    meaning: string;
    hanja_word_examples: { id: string; sentence: string; explanation: string | null; created_at: string }[];
  } | null;
};

/** GET /api/hanja/{id} — 한자 상세: 음·뜻·구성 설명·난이도·관련 단어·예문 + 내 학습 상태 (PRD 4.5) */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/hanja/[id]">) {
  return handle(async () => {
    const id = requireUuid((await ctx.params).id, "id");
    const { supabase } = await requireUser();

    const [charRes, wordRes, learnRes] = await Promise.all([
      supabase
        .from("hanja_characters")
        .select("id, character, reading, meaning, explanation, difficulty, sort_order")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("hanja_word_characters")
        .select("position, hanja_words(id, word, reading, meaning, hanja_word_examples(id, sentence, explanation, created_at))")
        .eq("character_id", id),
      supabase.from("hanja_learning").select("id, learning_date, status, completed_at").eq("character_id", id).maybeSingle(),
    ]);
    if (charRes.error) throw dbError(charRes.error);
    if (!charRes.data) throw new ApiError(404, "NOT_FOUND", "한자를 찾을 수 없습니다.");
    if (wordRes.error) throw dbError(wordRes.error);
    if (learnRes.error) throw dbError(learnRes.error);

    const words: HanjaWord[] = ((wordRes.data ?? []) as unknown as WordLinkRow[])
      .filter((r) => r.hanja_words)
      .map((r) => ({
        id: r.hanja_words!.id,
        word: r.hanja_words!.word,
        reading: r.hanja_words!.reading,
        meaning: r.hanja_words!.meaning,
        position: r.position,
        examples: [...r.hanja_words!.hanja_word_examples]
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .map(({ id: exId, sentence, explanation }) => ({ id: exId, sentence, explanation })),
      }))
      .sort((a, b) => a.word.localeCompare(b.word, "ko") || a.id.localeCompare(b.id));

    const l = learnRes.data;
    const detail: HanjaDetail = {
      ...charRes.data,
      words,
      learning: l
        ? { learning_id: l.id, learning_date: l.learning_date, status: l.status as LearningStatus, completed_at: l.completed_at }
        : null,
    };
    return ok(detail);
  });
}
