/** 화면 표시용 포맷 (서버·브라우저 공용, 서버 전용 모듈을 가져오지 않음) */

/** 12000 → 12,000원 */
export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 부호 포함: 3000 → +3,000원, -3000 → -3,000원 */
export function formatSignedWon(n: number): string {
  if (n === 0) return "0원";
  return `${n > 0 ? "+" : "-"}${Math.abs(n).toLocaleString("ko-KR")}원`;
}
