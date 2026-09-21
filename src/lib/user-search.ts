// 관리자 사용자 검색 (F29 · Issue #86) — DB 도 server-only 도 import 하지 않는다.
//
// 검색 자체는 tabs.tsx 안에서 몇 줄이면 끝나는 일이지만, `npm test` 의 대상이
// `src/**/*.test.ts` 라 **`.tsx` 는 테스트할 수 없다**(이 저장소에는 컴포넌트 테스트
// 인프라가 없다). 그래서 판정 규칙만 여기로 빼 두고 컴포넌트는 얇게 쓴다 —
// kst-date.ts(seoulDayKey)를 History 필터가 쓰는 것과 같은 구조다.

/**
 * 검색 대상 세 칸. users 에서 모두 NOT NULL 이라(db/schema.sql) 옵셔널로 두지 않는다 —
 * 전부 옵셔널이면 weak type 이 되어 adminUsers() 가 칼럼 이름을 바꿔도 tsc 가 잡지 못하고
 * 검색만 조용히 망가진다.
 */
export type UserSearchFields = {
  name: string;
  email: string;
  student_id: string;
};

/**
 * 검색 비교용으로 맞춘다 — 앞뒤 공백을 떼고 소문자로 둔다.
 *
 * `toLocaleLowerCase()` 가 아니라 `toLowerCase()` 인 이유: 이메일은 저장할 때
 * normalizeEmail()(school-email.ts)의 `toLowerCase()` 로 이미 정규화되어 있어
 * **같은 규칙**이어야 항상 일치한다. locale 을 타는 casing 은 브라우저 locale 에 따라
 * (tr 에서 'I' → 'ı') 이메일 검색만 깨뜨리고, 한글 이름에는 대소문자가 없어 이점이 없다.
 *
 * normalizeEmail 을 그대로 쓰지 않는 것은 그 함수의 뜻이 「이메일을 저장 · 비교하는 형태」라서다.
 * 여기 들어오는 값은 이메일만이 아니다.
 *
 * 인자를 `unknown` 으로 받는 것은 sql<T> 가 검사 없는 캐스트라(db.ts) 타입이 `string` 이어도
 * 런타임에 null 이 올 수 있기 때문이다 — normalizeEmail 과 같은 방어다.
 */
export function normalizeSearchText(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * 이름 · 이메일 · 학번 중 하나라도 검색어를 부분 문자열로 품으면 맞는 것으로 본다.
 *
 * 검색어가 비어 있으면(공백만 있어도) 받은 배열을 **그대로** 돌려준다 — 검색어를 지웠을 때
 * 전체 목록이 즉시 복원되어야 하기 때문이다.
 *
 * filter 는 원본 객체 참조를 유지한다. 걸러낸 행에서 누르는 경고 부여 · 차감이 엉뚱한
 * 사용자에게 가지 않으려면 이 성질이 필요하다(05 P16 — 사람은 user_id 로 가리킨다).
 *
 * 호실은 일부러 넣지 않았다 — 07-screens.md · 디자인 시안이 호실은 별도 드롭다운으로
 * 정해 두었고, Issue #86 의 검색 대상도 이름 · 이메일 · 학번 셋이다.
 */
export function filterUsersBySearch<T extends UserSearchFields>(
  rows: readonly T[],
  query: string,
): readonly T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return rows;

  return rows.filter(
    (u) =>
      normalizeSearchText(u.name).includes(normalizedQuery) ||
      normalizeSearchText(u.email).includes(normalizedQuery) ||
      normalizeSearchText(u.student_id).includes(normalizedQuery),
  );
}
