"use client";

import type { OptionId, QuizOption } from "@/lib/quiz";

export const quizButtonClass = "rounded px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

/** 4지선다 보기. result가 있으면 정답/내 선택을 기호+글자로 함께 표시 (색만으로 구분하지 않음) */
export function OptionList(props: {
  name: string;
  options: QuizOption[];
  selected: OptionId | null;
  onSelect?: (id: OptionId) => void;
  disabled?: boolean;
  result?: { selected_option_id: OptionId; correct_option_id: OptionId } | null;
}) {
  const { result } = props;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="보기">
      {props.options.map((o) => {
        const isSelected = (result?.selected_option_id ?? props.selected) === o.id;
        const isCorrect = result?.correct_option_id === o.id;
        const wrongPick = !!result && isSelected && !isCorrect;
        const tone = result
          ? isCorrect
            ? "border-green-600 bg-green-50 text-green-900"
            : wrongPick
              ? "border-red-500 bg-red-50 text-red-900"
              : "border-gray-200 bg-white text-gray-500"
          : isSelected
            ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600"
            : "border-gray-300 bg-white text-gray-800 hover:border-blue-400";
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            name={props.name}
            aria-checked={isSelected}
            disabled={props.disabled || !!result}
            onClick={() => props.onSelect?.(o.id)}
            className={`flex items-center gap-3 rounded border px-3 py-2 text-left text-sm disabled:cursor-default ${tone}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
              {o.id}
            </span>
            <span className="flex-1 font-medium">{o.text}</span>
            {result && isCorrect && <span className="text-xs font-semibold">✓ 정답</span>}
            {wrongPick && <span className="text-xs font-semibold">✕ 내 선택</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ResultBox(props: {
  is_correct: boolean;
  correct_option_id: OptionId;
  correct_answer: string;
  explanation: string | null;
}) {
  return (
    <div
      role="status"
      className={`mt-3 rounded border p-3 text-sm ${
        props.is_correct ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <p className="font-bold">{props.is_correct ? "✓ 정답입니다!" : "✕ 아쉬워요, 오답입니다."}</p>
      <p className="mt-1">
        정답: {props.correct_option_id}. {props.correct_answer}
      </p>
      {props.explanation && <p className="mt-1 text-gray-700">{props.explanation}</p>}
    </div>
  );
}
