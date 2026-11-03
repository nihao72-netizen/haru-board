"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import type { BudgetLine, BudgetStatus, BudgetSummary, MonthlyStats } from "@/lib/budget";
import { formatKoreanMonth, shiftMonth } from "@/lib/date";
import { formatSignedWon, formatWon } from "@/lib/format";

type Notice = { kind: "success" | "error"; text: string } | null;

const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const buttonClass = "rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

/** 상태는 색만으로 구분하지 않도록 기호 + 글자를 함께 표시 */
const statusMeta: Record<BudgetStatus, { label: string; icon: string; badge: string; bar: string }> = {
  normal: { label: "정상", icon: "●", badge: "bg-green-100 text-green-800", bar: "bg-green-600" },
  warning: { label: "주의 (80% 이상)", icon: "▲", badge: "bg-amber-100 text-amber-900", bar: "bg-amber-500" },
  limit_reached: { label: "한도 도달", icon: "■", badge: "bg-orange-100 text-orange-900", bar: "bg-orange-600" },
  exceeded: { label: "초과", icon: "✕", badge: "bg-red-100 text-red-800", bar: "bg-red-600" },
  not_set: { label: "미설정", icon: "–", badge: "bg-gray-100 text-gray-600", bar: "bg-gray-300" },
};

function parseAmountInput(v: string) {
  const n = Number(v.replaceAll(",", "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function StatsPanel({ thisMonth, onNotice }: { thisMonth: string; onNotice: (n: Notice) => void }) {
  const [month, setMonth] = useState(thisMonth);
  const [token, setToken] = useState(0);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const requestKey = `${month}#${token}`;
  const loading = loadedKey !== requestKey;
  const reload = () => setToken((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    const [m] = requestKey.split("#");
    Promise.all([
      api<MonthlyStats>(`/api/transactions/stats?month=${m}&months=6`),
      api<BudgetSummary>(`/api/budgets/${m}/summary`),
    ])
      .then(([s, b]) => {
        if (cancelled) return;
        setStats(s);
        setSummary(b);
        setLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  // 다른 달 데이터가 잠깐 보이지 않도록, 현재 월과 일치하는 응답만 사용
  const s = stats?.month === month ? stats : null;
  const b = summary?.month === month ? summary : null;

  return (
    <div className="space-y-6" aria-busy={loading}>
      <section className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-4 shadow sm:p-6" aria-label="월 선택">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className={`${buttonClass} bg-gray-100 py-1 hover:bg-gray-200`}
        >
          ◀
        </button>
        <p className="min-w-28 text-center text-lg font-bold text-gray-900">{formatKoreanMonth(month)}</p>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className={`${buttonClass} bg-gray-100 py-1 hover:bg-gray-200`}
        >
          ▶
        </button>
        {month !== thisMonth && (
          <button type="button" onClick={() => setMonth(thisMonth)} className={`${buttonClass} py-1 text-blue-700`}>
            이번 달
          </button>
        )}
        {loading && <span className="text-xs text-gray-500">불러오는 중…</span>}
      </section>

      {loadError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          통계를 불러오지 못했습니다: {loadError}
          <button type="button" className="ml-2 underline" onClick={reload}>
            다시 시도
          </button>
        </div>
      ) : !s || !b ? (
        <div className="rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>
      ) : (
        <>
          <MonthlyComparison stats={s} />
          <BudgetSection
            key={b.month}
            summary={b}
            onChanged={(text) => {
              onNotice({ kind: "success", text });
              reload();
            }}
            onError={(text) => onNotice({ kind: "error", text })}
          />
          <CategorySpending stats={s} />
        </>
      )}
    </div>
  );
}

/** 월별 지출 비교 (단일 계열 막대) + 전월 대비 증감 */
function MonthlyComparison({ stats }: { stats: MonthlyStats }) {
  const max = Math.max(...stats.months.map((m) => m.total_expense), 1);
  const { comparison: c } = stats;

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <h2 className="text-lg font-bold">월별 지출 비교</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded bg-gray-50 p-3">
          <p className="text-xs text-gray-600">{formatKoreanMonth(stats.month)} 지출</p>
          <p className="mt-1 break-all text-xl font-bold text-gray-900">{formatWon(c.current_expense)}</p>
        </div>
        <div className="rounded bg-gray-50 p-3">
          <p className="text-xs text-gray-600">전월 대비</p>
          {c.change_amount === null ? (
            <p className="mt-1 text-sm text-gray-700">비교 불가 (전월 지출이 없습니다)</p>
          ) : (
            <p className="mt-1 break-all text-xl font-bold text-gray-900">
              {c.change_amount > 0 ? "▲ " : c.change_amount < 0 ? "▼ " : ""}
              {formatSignedWon(c.change_amount)}
              <span className="ml-1 text-sm font-medium text-gray-600">
                ({c.change_rate! > 0 ? "+" : ""}
                {c.change_rate}%)
              </span>
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">전월 지출 {formatWon(c.previous_expense)}</p>
        </div>
      </div>

      <div className="mt-5 flex h-44 items-end gap-0.5 border-b border-gray-300" role="img" aria-label="최근 6개월 월별 지출 막대 그래프">
        {stats.months.map((m) => {
          const current = m.month === stats.month;
          const pct = (m.total_expense / max) * 100;
          return (
            <div key={m.month} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              {current && (
                <span className="mb-1 whitespace-nowrap text-[11px] font-semibold text-gray-800">{formatWon(m.total_expense)}</span>
              )}
              <div
                title={`${formatKoreanMonth(m.month)} 지출 ${formatWon(m.total_expense)}`}
                className={`w-full max-w-12 rounded-t ${current ? "bg-red-600" : "bg-red-300"} ${m.total_expense > 0 ? "min-h-[2px]" : ""}`}
                style={{ height: `${pct}%` }}
              />
              {/* 마우스를 올리면 금액 표시 */}
              <span className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow group-hover:block">
                {formatKoreanMonth(m.month)} · {formatWon(m.total_expense)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5">
        {stats.months.map((m) => (
          <span
            key={m.month}
            className={`flex-1 text-center text-xs ${m.month === stats.month ? "font-semibold text-gray-900" : "text-gray-500"}`}
          >
            {Number(m.month.slice(5, 7))}월
          </span>
        ))}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-gray-600">표로 보기</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="py-1 font-medium">월</th>
              <th className="py-1 text-right font-medium">수입</th>
              <th className="py-1 text-right font-medium">지출</th>
            </tr>
          </thead>
          <tbody>
            {stats.months.map((m) => (
              <tr key={m.month} className="border-b border-gray-100">
                <td className="py-1">{formatKoreanMonth(m.month)}</td>
                <td className="py-1 text-right">{formatWon(m.total_income)}</td>
                <td className="py-1 text-right">{formatWon(m.total_expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

/** 분류별 지출 (가로 막대, 단일 색) */
function CategorySpending({ stats }: { stats: MonthlyStats }) {
  const max = Math.max(...stats.categories.map((c) => c.amount), 1);
  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <h2 className="text-lg font-bold">분류별 지출</h2>
      <p className="mt-1 text-xs text-gray-500">{formatKoreanMonth(stats.month)} 지출을 분류별로 모았습니다.</p>
      {stats.categories.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">이 달의 지출 기록이 없습니다.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {stats.categories.map((c) => (
            <li key={c.category_id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-gray-800">{c.name}</span>
                <span className="shrink-0 text-gray-700">
                  {formatWon(c.amount)} <span className="text-xs text-gray-500">({c.ratio}%)</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 rounded bg-gray-100">
                <div className="h-full rounded bg-red-500" style={{ width: `${(c.amount / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UsageBar({ line }: { line: BudgetLine }) {
  const meta = statusMeta[line.status];
  const pct = line.usage_rate === null ? 0 : Math.min(line.usage_rate, 100);
  return (
    <div
      className="mt-2 h-2.5 rounded bg-gray-100"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label="예산 사용률"
    >
      <div className={`h-full rounded ${meta.bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: BudgetStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function BudgetSection(props: { summary: BudgetSummary; onChanged: (text: string) => void; onError: (text: string) => void }) {
  const { summary } = props;
  const { overall } = summary;
  const month = summary.month;
  const [amount, setAmount] = useState(overall.budget ? String(overall.budget) : "");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      props.onChanged(success);
      return true;
    } catch (e) {
      props.onError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <h2 className="text-lg font-bold">{formatKoreanMonth(month)} 예산</h2>

      {/* 전체 예산 */}
      <div className="mt-4 rounded border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">전체 예산</h3>
          <StatusBadge status={overall.status} />
        </div>
        {overall.budget !== null ? (
          <>
            <UsageBar line={overall} />
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-gray-500">예산</dt>
                <dd className="font-medium">{formatWon(overall.budget)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">지출</dt>
                <dd className="font-medium">{formatWon(overall.spent)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">남은 예산</dt>
                <dd className={`font-medium ${overall.remaining! < 0 ? "text-red-700" : ""}`}>{formatSignedWon(overall.remaining!)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">사용률</dt>
                <dd className="font-medium">{overall.usage_rate}%</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            아직 이 달의 전체 예산이 없습니다. 이 달 지출은 {formatWon(overall.spent)}입니다.
          </p>
        )}

        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const n = parseAmountInput(amount);
            if (n === null) return props.onError("예산은 1원 이상의 정수로 입력해 주세요.");
            await run(
              () => api(`/api/budgets/${month}`, { method: "PUT", body: JSON.stringify({ amount: n }) }),
              overall.budget === null ? "전체 예산을 설정했습니다." : "전체 예산을 수정했습니다.",
            );
          }}
        >
          <input
            className={`${inputClass} min-w-0 flex-1`}
            inputMode="numeric"
            aria-label="전체 예산 금액(원)"
            placeholder="예: 1000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))}
          />
          <button type="submit" disabled={busy} className={`${buttonClass} shrink-0 bg-blue-600 text-white hover:bg-blue-700`}>
            {overall.budget === null ? "설정" : "수정"}
          </button>
          {overall.budget !== null && (
            <button
              type="button"
              disabled={busy}
              className={`${buttonClass} shrink-0 bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50`}
              onClick={() => {
                if (!window.confirm("전체 예산을 삭제할까요? 이 달의 분류별 예산도 함께 삭제됩니다. 거래와 분류는 그대로 남습니다.")) return;
                void run(() => api(`/api/budgets/${month}`, { method: "DELETE" }), "전체 예산을 삭제했습니다.").then((ok) => {
                  if (ok) setAmount("");
                });
              }}
            >
              삭제
            </button>
          )}
        </form>
      </div>

      {/* 분류별 예산 */}
      <div className="mt-6">
        <h3 className="font-semibold text-gray-900">분류별 예산</h3>
        <p className="mt-1 text-xs text-gray-500">
          지출 분류마다 따로 정합니다. 전체 예산과 분류별 예산은 서로 더하지 않으며, 분류 예산이 없는 지출도 전체 지출에 포함됩니다.
        </p>
        {overall.budget === null ? (
          <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-600">전체 예산을 먼저 설정하면 분류별 예산을 정할 수 있습니다.</p>
        ) : summary.categories.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">지출 분류가 없습니다. 거래 내역 탭의 분류 관리에서 추가해 주세요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {summary.categories.map((c) => (
              <CategoryBudgetRow key={c.category_id} month={month} line={c} busy={busy} run={run} onError={props.onError} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CategoryBudgetRow(props: {
  month: string;
  line: BudgetSummary["categories"][number];
  busy: boolean;
  run: (action: () => Promise<unknown>, success: string) => Promise<boolean>;
  onError: (text: string) => void;
}) {
  const { line } = props;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(line.budget ? String(line.budget) : "");
  const path = `/api/budgets/${props.month}/categories/${line.category_id}`;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-gray-800">{line.name}</span>
        <StatusBadge status={line.status} />
      </div>
      <p className="mt-1 text-sm text-gray-600">
        지출 {formatWon(line.spent)}
        {line.budget !== null && (
          <>
            {" "}
            / 예산 {formatWon(line.budget)} · 사용률 {line.usage_rate}% · 남은 예산{" "}
            <span className={line.remaining! < 0 ? "font-medium text-red-700" : ""}>{formatSignedWon(line.remaining!)}</span>
          </>
        )}
      </p>
      {line.budget !== null && <UsageBar line={line} />}

      {editing ? (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const n = parseAmountInput(amount);
            if (n === null) return props.onError("예산은 1원 이상의 정수로 입력해 주세요.");
            const ok = await props.run(
              () => api(path, { method: "PUT", body: JSON.stringify({ amount: n }) }),
              `'${line.name}' 예산을 저장했습니다.`,
            );
            if (ok) setEditing(false);
          }}
        >
          <input
            className={`${inputClass} min-w-0 flex-1`}
            inputMode="numeric"
            aria-label={`${line.name} 예산 금액(원)`}
            placeholder="예: 300000"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))}
          />
          <button type="submit" disabled={props.busy} className={`${buttonClass} shrink-0 bg-blue-600 text-white`}>
            저장
          </button>
          <button type="button" onClick={() => setEditing(false)} className={`${buttonClass} shrink-0 bg-gray-100`}>
            취소
          </button>
        </form>
      ) : (
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
            onClick={() => {
              setAmount(line.budget ? String(line.budget) : "");
              setEditing(true);
            }}
          >
            {line.budget === null ? "예산 설정" : "예산 수정"}
          </button>
          {line.budget !== null && (
            <button
              type="button"
              disabled={props.busy}
              className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              onClick={() => {
                if (!window.confirm(`'${line.name}' 분류 예산을 삭제할까요?`)) return;
                void props.run(() => api(path, { method: "DELETE" }), `'${line.name}' 예산을 삭제했습니다.`);
              }}
            >
              예산 삭제
            </button>
          )}
        </div>
      )}
    </li>
  );
}
