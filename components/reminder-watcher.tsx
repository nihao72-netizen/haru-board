"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { Entry } from "@/lib/entries";

type Due = Pick<Entry, "id" | "title" | "remind_at">;
const STORE = "haru:notified-reminders";
const POLL_MS = 30_000;

function loadNotified(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch {
    return [];
  }
}
function markNotified(key: string) {
  try {
    const list = [...loadNotified().filter((k) => k !== key), key].slice(-200);
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {}
}

/**
 * 미리 알림: 화면이 열려 있는 동안 30초마다 곧 다가올 알림을 확인하고, 시각이 되면
 * 브라우저 알림(허용한 경우)과 화면 오른쪽 아래 배너로 알려 준다.
 * 앱을 닫아 두면 알림이 오지 않는다(서버 푸시 미구현 — README 제한 사항).
 */
export function ReminderWatcher() {
  const [banners, setBanners] = useState<Due[]>([]);

  useEffect(() => {
    let stopped = false;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const fire = (t: Due) => {
      const key = `${t.id}@${t.remind_at}`;
      if (loadNotified().includes(key)) return;
      markNotified(key);
      setBanners((b) => [...b.filter((x) => x.id !== t.id), t]);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("하루정리 미리 알림", { body: t.title, tag: key });
        } catch {}
      }
    };

    const check = async () => {
      const now = Date.now();
      // 놓친 알림(최근 10분)과 다음 확인 전까지 올 알림
      const from = new Date(now - 10 * 60_000).toISOString();
      const to = new Date(now + POLL_MS + 5_000).toISOString();
      try {
        const r = await api<{ items: Due[] }>(
          `/api/entries?type=todo&status=incomplete&remind_from=${encodeURIComponent(from)}&remind_to=${encodeURIComponent(to)}&limit=50`,
        );
        if (stopped) return;
        for (const t of r.items) {
          if (!t.remind_at) continue;
          const key = `${t.id}@${t.remind_at}`;
          if (timers.has(key) || loadNotified().includes(key)) continue;
          const delay = Math.max(0, Date.parse(t.remind_at) - Date.now());
          timers.set(key, setTimeout(() => fire(t), delay));
        }
      } catch {
        // 로그아웃·네트워크 오류는 조용히 다음 확인 때 재시도
      }
    };

    void check();
    const iv = setInterval(() => void check(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(iv);
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (banners.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="alert" aria-live="assertive">
      {banners.map((b) => (
        <div key={b.id} className="rounded-lg border border-orange-200 bg-white p-3 text-sm shadow-lg">
          <p className="font-semibold text-orange-800">⏰ 미리 알림</p>
          <p className="mt-1 break-words text-gray-900">{b.title}</p>
          <div className="mt-2 flex gap-3 text-xs">
            <Link href={`/todos?view=today&task=${b.id}`} className="text-blue-700 hover:underline" onClick={() => setBanners((x) => x.filter((y) => y.id !== b.id))}>
              작업 열기
            </Link>
            <button type="button" className="text-gray-500 hover:underline" onClick={() => setBanners((x) => x.filter((y) => y.id !== b.id))}>
              닫기
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
