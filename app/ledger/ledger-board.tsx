"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/api/client";
import { addDays, formatKoreanDate, periodRange, todayKST, type Period } from "@/lib/date";
import { formatSignedWon, formatWon } from "@/lib/format";
import type { Transaction, TxCategory, TxSummary, TxType } from "@/lib/ledger";
import { StatsPanel } from "./stats-panel";

type ListResult = {
  items: Transaction[];
  page: number;
  limit: number;
  total: number;
  start_date: string;
  end_date: string;
};
type Notice = { kind: "success" | "error"; text: string } | null;
type TypeFilter = "all" | TxType;

const PAGE_SIZE = 20;
const NEW_CATEGORY = "__new__";
const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const buttonClass = "rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
const typeLabel: Record<TxType, string> = { income: "수입", expense: "지출" };

function shiftDate(period: Period, date: string, dir: 1 | -1) {
  if (period === "day") return addDays(date, dir);
  if (period === "week") return addDays(date, dir * 7);
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1)).toISOString().slice(0, 10);
}

function rangeLabel(period: Period, date: string) {
  const { start, end } = periodRange(period, date);
  if (period === "day") return formatKoreanDate(start);
  if (period === "month") return `${start.slice(0, 4)}년 ${Number(start.slice(5, 7))}월`;
  return `${formatKoreanDate(start)} ~ ${formatKoreanDate(end)}`;
}

/** 분류 선택값이 '기타(새 분류)'면 분류를 먼저 만들고 그 id를 돌려준다. 같은 이름이 있으면 그것을 재사용. */
async function resolveCategory(type: TxType, selected: string, newName: string, categories: TxCategory[]) {
  if (selected !== NEW_CATEGORY) return { id: selected, created: false };
  const name = newName.trim();
  if (!name) throw new Error("새 분류 이름을 입력해 주세요.");
  const existing = categories.find((c) => c.type === type && c.name === name);
  if (existing) return { id: existing.id, created: false };
  try {
    const c = await api<TxCategory>("/api/transaction-categories", {
      method: "POST",
      body: JSON.stringify({ type, name }),
    });
    return { id: c.id, created: true };
  } catch (e) {
    if (e instanceof ClientApiError && e.status === 409) {
      const list = await api<TxCategory[]>(`/api/transaction-categories?type=${type}`);
      const found = list.find((c) => c.name === name);
      if (found) return { id: found.id, created: false };
    }
    throw e;
  }
}

export function LedgerBoard() {
  const today = todayKST();
  const [tab, setTab] = useState<"list" | "stats">("list");
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(today);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [categories, setCategories] = useState<TxCategory[]>([]);
  const [categoryToken, setCategoryToken] = useState(0);
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<TxSummary | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const listQuery = useMemo(() => {
    const q = new URLSearchParams({ period, date, type: typeFilter, page: String(page), limit: String(PAGE_SIZE) });
    if (categoryFilter) q.set("category_id", categoryFilter);
    if (search) q.set("search", search);
    return q.toString();
  }, [period, date, typeFilter, categoryFilter, search, page]);
  const requestKey = `${listQuery}#${reloadToken}`;
  const loading = loadedKey !== requestKey;

  const reload = () => {
    setPage(1);
    setReloadToken((t) => t + 1);
  };
  const reloadCategories = () => setCategoryToken((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    api<TxCategory[]>("/api/transaction-categories")
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch((e) => {
        if (!cancelled) setNotice({ kind: "error", text: `분류를 불러오지 못했습니다: ${errorMessage(e)}` });
      });
    return () => {
      cancelled = true;
    };
  }, [categoryToken]);

  useEffect(() => {
    let cancelled = false;
    const [query, token] = requestKey.split("#");
    const params = new URLSearchParams(query);
    const isFirstPage = params.get("page") === "1";
    const listPromise = api<ListResult>(`/api/transactions?${query}`);
    // 합계는 기간이 바뀌거나 다시 불러올 때만 (유형·분류·검색 필터와 독립)
    const summaryPromise = isFirstPage
      ? api<TxSummary>(`/api/transactions/summary?period=${params.get("period")}&date=${params.get("date")}&_=${token}`)
      : Promise.resolve(null);
    Promise.all([listPromise, summaryPromise])
      .then(([list, sum]) => {
        if (cancelled) return;
        setItems((prev) => (list.page === 1 ? list.items : [...prev, ...list.items]));
        setTotal(list.total);
        if (sum) setSummary(sum);
        setListError(null);
      })
      .catch((e) => {
        if (!cancelled) setListError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const filterCategories = categories.filter((c) => typeFilter === "all" || c.type === typeFilter);

  function changePeriod(next: Period) {
    setPeriod(next);
    setPage(1);
  }
  function changeDate(next: string) {
    if (!next) return;
    setDate(next);
    setPage(1);
  }

  async function remove(tx: Transaction) {
    if (!window.confirm(`'${tx.name}' ${formatWon(tx.amount)} 거래를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await api(`/api/transactions/${tx.id}`, { method: "DELETE" });
      setNotice({ kind: "success", text: "거래를 삭제했습니다." });
      reload();
    } catch (e) {
      setNotice({ kind: "error", text: `삭제하지 못했습니다: ${errorMessage(e)}` });
    }
  }

  const hasFilter = typeFilter !== "all" || categoryFilter || search;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex gap-2 border-b border-gray-200" role="tablist" aria-label="가계부 탭">
        {(
          [
            ["list", "거래 내역"],
            ["stats", "통계·예산"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
              tab === value ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded border px-4 py-3 text-sm ${
            notice.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs underline">
            닫기
          </button>
        </div>
      )}

      {tab === "stats" ? (
        <StatsPanel thisMonth={today.slice(0, 7)} onNotice={setNotice} />
      ) : (
        <>
          {/* 기간 선택 + 합계 */}
          <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-label="기간과 합계">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" role="radiogroup" aria-label="기간 단위">
                {(
                  [
                    ["day", "일"],
                    ["week", "주"],
                    ["month", "월"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={period === value}
                    onClick={() => changePeriod(value)}
                    className={`${buttonClass} py-1 ${period === value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="이전 기간"
                  onClick={() => changeDate(shiftDate(period, date, -1))}
                  className={`${buttonClass} bg-gray-100 py-1 hover:bg-gray-200`}
                >
                  ◀
                </button>
                <input
                  type="date"
                  aria-label="기준 날짜"
                  className={`${inputClass} w-auto py-1`}
                  value={date}
                  onChange={(e) => changeDate(e.target.value)}
                />
                <button
                  type="button"
                  aria-label="다음 기간"
                  onClick={() => changeDate(shiftDate(period, date, 1))}
                  className={`${buttonClass} bg-gray-100 py-1 hover:bg-gray-200`}
                >
                  ▶
                </button>
                {date !== today && (
                  <button type="button" onClick={() => changeDate(today)} className={`${buttonClass} py-1 text-blue-700`}>
                    오늘
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 font-semibold text-gray-900">{rangeLabel(period, date)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-blue-50 p-3">
                <p className="text-xs text-blue-800">총수입</p>
                <p className="mt-1 break-all text-sm font-bold text-blue-900 sm:text-base">
                  {summary ? formatWon(summary.total_income) : "…"}
                </p>
              </div>
              <div className="rounded bg-red-50 p-3">
                <p className="text-xs text-red-800">총지출</p>
                <p className="mt-1 break-all text-sm font-bold text-red-900 sm:text-base">
                  {summary ? formatWon(summary.total_expense) : "…"}
                </p>
              </div>
              <div className="rounded bg-gray-100 p-3">
                <p className="text-xs text-gray-700">차액</p>
                <p className="mt-1 break-all text-sm font-bold text-gray-900 sm:text-base">
                  {summary ? formatSignedWon(summary.balance) : "…"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">합계는 아래 유형·분류·검색 필터와 관계없이 선택한 기간 전체 기준입니다.</p>
          </section>

          <TxForm
            mode="create"
            categories={categories}
            defaultDate={today}
            onSaved={(_tx, createdCategory) => {
              setNotice({ kind: "success", text: "거래를 추가했습니다." });
              if (createdCategory) reloadCategories();
              reload();
            }}
            onError={(msg) => setNotice({ kind: "error", text: msg })}
          />

          <TxCategoryManager categories={categories} onChanged={reloadCategories} onNotice={setNotice} />

          {/* 목록 필터 */}
          <section className="rounded-lg bg-white p-4 shadow sm:p-6" aria-label="목록 필터">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-gray-700">
                유형
                <select
                  className={`${inputClass} mt-1`}
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as TypeFilter);
                    setCategoryFilter("");
                    setPage(1);
                  }}
                >
                  <option value="all">전체</option>
                  <option value="expense">지출</option>
                  <option value="income">수입</option>
                </select>
              </label>
              <label className="text-sm text-gray-700">
                분류
                <select
                  className={`${inputClass} mt-1`}
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">전체</option>
                  {filterCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{typeLabel[c.type]}] {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <form
                className="text-sm text-gray-700"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(searchInput.trim());
                  setPage(1);
                }}
              >
                <label htmlFor="tx-search">검색 (거래명·메모)</label>
                <div className="mt-1 flex gap-1">
                  <input
                    id="tx-search"
                    type="search"
                    className={inputClass}
                    value={searchInput}
                    maxLength={100}
                    placeholder="검색어"
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <button type="submit" className={`${buttonClass} bg-gray-800 text-white hover:bg-gray-900`}>
                    검색
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* 목록 */}
          <section aria-label="거래 목록" aria-busy={loading}>
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>목록 {total}건</span>
              {hasFilter && (
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setTypeFilter("all");
                    setCategoryFilter("");
                    setSearch("");
                    setSearchInput("");
                    setPage(1);
                  }}
                >
                  필터 초기화
                </button>
              )}
            </div>

            {listError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
                거래를 불러오지 못했습니다: {listError}
                <button type="button" className="ml-2 underline" onClick={reload}>
                  다시 시도
                </button>
              </div>
            ) : loading && items.length === 0 ? (
              <div className="rounded-lg bg-white p-6 text-sm text-gray-500 shadow">불러오는 중…</div>
            ) : items.length === 0 ? (
              <div className="rounded-lg bg-white p-6 text-sm text-gray-500 shadow">
                {hasFilter ? "조건에 맞는 거래가 없습니다." : "이 기간에 기록한 거래가 없습니다."}
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((tx) => (
                  <TxItem
                    key={tx.id}
                    tx={tx}
                    category={categoryById.get(tx.category_id)}
                    categories={categories}
                    onDelete={() => remove(tx)}
                    onSaved={(createdCategory) => {
                      setNotice({ kind: "success", text: "거래를 수정했습니다." });
                      if (createdCategory) reloadCategories();
                      reload();
                    }}
                    onError={(msg) => setNotice({ kind: "error", text: msg })}
                  />
                ))}
              </ul>
            )}

            {!listError && items.length < total && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPage((p) => p + 1)}
                  className={`${buttonClass} bg-white text-gray-800 shadow hover:bg-gray-50`}
                >
                  {loading ? "불러오는 중…" : `더 보기 (${items.length}/${total})`}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TxItem(props: {
  tx: Transaction;
  category: TxCategory | undefined;
  categories: TxCategory[];
  onDelete: () => void;
  onSaved: (createdCategory: boolean) => void;
  onError: (msg: string) => void;
}) {
  const { tx } = props;
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <TxForm
          mode="edit"
          tx={tx}
          categories={props.categories}
          defaultDate={tx.transaction_date}
          onSaved={(_t, created) => {
            setEditing(false);
            props.onSaved(created);
          }}
          onCancel={() => setEditing(false)}
          onError={props.onError}
        />
      </li>
    );
  }

  const income = tx.type === "income";
  return (
    <li className="rounded-lg bg-white p-4 shadow">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
            income ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
          }`}
        >
          {typeLabel[tx.type]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="break-words font-medium text-gray-900">{tx.name}</p>
            <p className={`shrink-0 font-bold ${income ? "text-blue-700" : "text-red-700"}`}>
              {income ? "+" : "-"}
              {formatWon(tx.amount)}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{props.category?.name ?? "(분류 없음)"}</span>
            <span>{formatKoreanDate(tx.transaction_date)}</span>
          </div>
          {tx.memo && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{tx.memo}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <button type="button" onClick={() => setEditing(true)} className="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">
            수정
          </button>
          <button type="button" onClick={props.onDelete} className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50">
            삭제
          </button>
        </div>
      </div>
    </li>
  );
}

function TxForm(props: {
  mode: "create" | "edit";
  tx?: Transaction;
  categories: TxCategory[];
  defaultDate: string;
  onSaved: (tx: Transaction, createdCategory: boolean) => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { tx, categories } = props;
  const [type, setType] = useState<TxType>(tx?.type ?? "expense");
  const [categoryId, setCategoryId] = useState(tx?.category_id ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [txDate, setTxDate] = useState(tx?.transaction_date ?? props.defaultDate);
  const [name, setName] = useState(tx?.name ?? "");
  const [amount, setAmount] = useState(tx ? String(tx.amount) : "");
  const [memo, setMemo] = useState(tx?.memo ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const typeCategories = categories.filter((c) => c.type === type);
  // 유형이 바뀌어 기존 선택이 맞지 않으면 그 유형의 첫 분류를 사용
  const selected =
    categoryId === NEW_CATEGORY || typeCategories.some((c) => c.id === categoryId)
      ? categoryId
      : (typeCategories[0]?.id ?? NEW_CATEGORY);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount.replaceAll(",", ""));
    if (!name.trim()) return setFieldError("거래명을 입력해 주세요.");
    if (!Number.isInteger(amountNum) || amountNum <= 0) return setFieldError("금액은 1원 이상의 정수로 입력해 주세요.");
    if (!txDate) return setFieldError("날짜를 선택해 주세요.");
    if (selected === NEW_CATEGORY && !newCategory.trim()) return setFieldError("새 분류 이름을 입력해 주세요.");
    setFieldError(null);
    setSaving(true);
    try {
      const cat = await resolveCategory(type, selected, newCategory, categories);
      const body = { type, category_id: cat.id, transaction_date: txDate, name, amount: amountNum, memo };
      const saved =
        props.mode === "create"
          ? await api<Transaction>("/api/transactions", { method: "POST", body: JSON.stringify(body) })
          : await api<Transaction>(`/api/transactions/${tx!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (props.mode === "create") {
        setName("");
        setAmount("");
        setMemo("");
        setNewCategory("");
        if (cat.created) setCategoryId(cat.id);
      }
      props.onSaved(saved, cat.created);
    } catch (err) {
      props.onError(`저장하지 못했습니다: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const idp = props.mode === "create" ? "new" : tx?.id;

  return (
    <form onSubmit={submit} className="rounded-lg bg-white p-4 shadow sm:p-6" noValidate>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{props.mode === "create" ? "거래 입력" : "거래 수정"}</h2>
        <div className="flex gap-1" role="radiogroup" aria-label="거래 유형">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`${buttonClass} py-1 ${
                type === t ? (t === "income" ? "bg-blue-600 text-white" : "bg-red-600 text-white") : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {typeLabel[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-gray-700" htmlFor={`name-${idp}`}>
          거래명 <span className="text-red-600">*</span>
          <input
            id={`name-${idp}`}
            className={`${inputClass} mt-1`}
            value={name}
            maxLength={200}
            placeholder={type === "expense" ? "예: 점심" : "예: 월급"}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-sm text-gray-700" htmlFor={`amount-${idp}`}>
          금액(원) <span className="text-red-600">*</span>
          <input
            id={`amount-${idp}`}
            className={`${inputClass} mt-1`}
            inputMode="numeric"
            value={amount}
            placeholder="예: 12000"
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))}
          />
        </label>
        <label className="text-sm text-gray-700">
          분류 <span className="text-red-600">*</span>
          <select className={`${inputClass} mt-1`} value={selected} onChange={(e) => setCategoryId(e.target.value)}>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>기타 (새 분류 입력)</option>
          </select>
        </label>
        <label className="text-sm text-gray-700">
          날짜 <span className="text-red-600">*</span>
          <input type="date" className={`${inputClass} mt-1`} value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        </label>
        {selected === NEW_CATEGORY && (
          <label className="text-sm text-gray-700 sm:col-span-2">
            새 {typeLabel[type]} 분류 이름 <span className="text-red-600">*</span>
            <input
              className={`${inputClass} mt-1`}
              value={newCategory}
              maxLength={50}
              placeholder="예: 카페"
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500">저장하면 분류가 함께 만들어지고 다음부터 목록에서 고를 수 있습니다.</span>
          </label>
        )}
        <label className="text-sm text-gray-700 sm:col-span-2">
          메모 (선택)
          <textarea
            className={`${inputClass} mt-1`}
            rows={2}
            value={memo}
            placeholder="무엇을 위해, 어떤 상황이었는지"
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>
      </div>

      {fieldError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {fieldError}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
          {saving ? "저장 중…" : props.mode === "create" ? "추가하기" : "저장"}
        </button>
        {props.onCancel && (
          <button type="button" onClick={props.onCancel} className={`${buttonClass} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}

function TxCategoryManager(props: {
  categories: TxCategory[];
  onChanged: () => void;
  onNotice: (n: Notice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState<TxType>("expense");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      props.onChanged();
      props.onNotice({ kind: "success", text: success });
      return true;
    } catch (e) {
      props.onNotice({ kind: "error", text: errorMessage(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-lg font-bold"
      >
        분류 관리
        <span className="text-sm font-normal text-gray-500">{open ? "접기 ▲" : `${props.categories.length}개 · 펼치기 ▼`}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newName.trim()) return props.onNotice({ kind: "error", text: "분류 이름을 입력해 주세요." });
              const ok = await run(
                () =>
                  api("/api/transaction-categories", { method: "POST", body: JSON.stringify({ type: newType, name: newName }) }),
                "분류를 추가했습니다.",
              );
              if (ok) setNewName("");
            }}
          >
            <select
              className={`${inputClass} w-auto`}
              aria-label="새 분류 유형"
              value={newType}
              onChange={(e) => setNewType(e.target.value as TxType)}
            >
              <option value="expense">지출</option>
              <option value="income">수입</option>
            </select>
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={newName}
              maxLength={50}
              placeholder="새 분류 이름"
              aria-label="새 분류 이름"
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" disabled={busy} className={`${buttonClass} shrink-0 bg-gray-800 text-white hover:bg-gray-900`}>
              추가
            </button>
          </form>
          {(["expense", "income"] as const).map((t) => (
            <div key={t}>
              <h3 className="text-sm font-semibold text-gray-700">{typeLabel[t]} 분류</h3>
              <ul className="mt-1 divide-y divide-gray-100">
                {props.categories
                  .filter((c) => c.type === t)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-2 py-2">
                      {editingId === c.id ? (
                        <form
                          className="flex flex-1 gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const ok = await run(
                              () =>
                                api(`/api/transaction-categories/${c.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ name: editName }),
                                }),
                              "분류 이름을 바꿨습니다.",
                            );
                            if (ok) setEditingId(null);
                          }}
                        >
                          <input
                            className={inputClass}
                            value={editName}
                            maxLength={50}
                            aria-label="분류 이름"
                            onChange={(e) => setEditName(e.target.value)}
                          />
                          <button type="submit" disabled={busy} className={`${buttonClass} shrink-0 bg-blue-600 text-white`}>
                            저장
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className={`${buttonClass} shrink-0 bg-gray-100`}>
                            취소
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{c.name}</span>
                          <button
                            type="button"
                            className="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              setEditingId(c.id);
                              setEditName(c.name);
                            }}
                          >
                            이름 변경
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (!window.confirm(`'${c.name}' 분류를 삭제할까요?`)) return;
                              void run(() => api(`/api/transaction-categories/${c.id}`, { method: "DELETE" }), "분류를 삭제했습니다.");
                            }}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-gray-500">거래나 예산이 사용 중인 분류는 삭제할 수 없습니다. 분류 유형(수입/지출)은 바꿀 수 없습니다.</p>
        </div>
      )}
    </section>
  );
}
