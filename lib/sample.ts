// 보기 전용 샘플 계정 (README에 공개된 계정).
// DB(마이그레이션 7)가 이 계정의 모든 쓰기와 비밀번호·이메일 변경을 막으므로, 비밀번호가 공개돼도 내용은 바뀌지 않는다.
export const SAMPLE_EMAIL = "aaa@aaa.com";
export const SAMPLE_PASSWORD = "dkssud";

export const isSampleEmail = (email: string | null | undefined) => (email ?? "").toLowerCase() === SAMPLE_EMAIL;
