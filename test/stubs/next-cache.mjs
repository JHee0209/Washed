// `next/cache` 대체 (Issue #84).
//
// user-actions.ts(requestWithdrawal · cancelWithdrawal)가 부르는 revalidatePath() 는
// Next 의 렌더 캐시를 무효화하는 배관일 뿐이라 node --test 에는 캐시 자체가 없다.
// 여기서는 아무것도 하지 않는 no-op 으로 둔다 — 판정 로직은 이 함수를 부르는지
// 여부와 무관하다(경로 문자열을 검사하지 않는다).
export function revalidatePath() {}
