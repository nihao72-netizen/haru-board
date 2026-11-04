/**
 * 로그인·로그아웃 직후에는 전체 페이지를 새로 불러온다.
 * Next.js 16은 최근 화면의 상태와 미리 불러온 링크 결과(로그인 전에 받은 "로그인 화면으로 이동")를
 * 보관해 두기 때문에, 화면 안에서만 이동하면 로그인 상태가 바뀐 것이 반영되지 않을 수 있다.
 */
export function navigateAfterAuthChange(path: string) {
  window.location.replace(path);
}
