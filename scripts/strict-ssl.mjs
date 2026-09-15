// Neon 접속 문자열의 sslmode 를 가장 엄격한 verify-full 로 못박는다.
//
// Neon 이 주는 문자열은 sslmode=require 인데, node-postgres 는 지금 그것을
// verify-full 과 같게 다루면서 "다음 major 에서는 약한 libpq 의미로 바뀐다" 는
// 경고를 낸다. 나중에 조용히 검증이 느슨해지지 않도록 여기서 직접 적어 둔다.

export function strictSsl(connectionString) {
  const url = new URL(connectionString);
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
