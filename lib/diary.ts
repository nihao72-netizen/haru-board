// 자유 일기 공용 타입·상수 (서버 전용 코드를 가져오지 않아 클라이언트에서도 사용 가능)

/** 일기 목록·요약용 (본문 제외). 본문은 비밀번호 재확인 후 read_diary로만 읽는다 */
export type DailyReview = { id: string; review_date: string; title: string | null; created_at: string; updated_at: string };
export type DiaryWithContent = DailyReview & { content: string };

export const DAILY_REVIEW_COLUMNS = "id, review_date, title, created_at, updated_at";

/** 일기 본문 최대 길이 */
export const DIARY_MAX = 10_000;
/** 일기 제목 최대 길이 */
export const DIARY_TITLE_MAX = 100;
/** 비밀번호 재확인 후 일기 본문을 볼 수 있는 시간 (DB 함수 app_private.diary_reauth_ok와 같은 값) */
export const DIARY_UNLOCK_MS = 10 * 60 * 1000;
