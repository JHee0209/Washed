// F4 · F5 · F9 알림 문구 — 04-features.md 의 F5·F9 행과 docs/design/i18n.js 의
// 번역 패턴(`(.+)를 바로 이용할 수 있어요…` · `(.+) 차례가 됐어요!…` · `(.+) 이용
// 시간이 끝났어요…`)을 그대로 따른다. 서버가 보내는 푸시는 아직 번역되지 않으므로
// (08 · 11번 · 12번 — 서버 언어 인지는 이번 Issue #12 범위 밖) 여기는 한국어 고정이다.
//
// DB · server-only 의존이 없는 순수 함수다 — report-rules.ts · kst-date.ts 와 같은
// 이유로 이렇게 따로 둔다. node --test 가 번들러 없이 직접 돌리므로, 이 파일을
// 불러오는 테스트는 `@/` 별칭 대신 상대 경로 + `.ts` 확장자를 쓴다.

export type AssignmentNotifyVariant = 'instant' | 'turn';

/** 06 「알림」 제목 · 예("세탁기 3호기에 배정됐어요") */
export function assignmentTitle(machineName: string): string {
  return `${machineName}에 배정됐어요`;
}

/**
 * instant — F4. 줄서는 그 자리에서 빈 기기가 있어 곧바로 배정됨.
 * turn    — F5. 이미 기다리던 차례가 옴(앞사람 종료 · 관리자 동작으로 기기가 풀림).
 */
export function assignmentBody(machineName: string, variant: AssignmentNotifyVariant): string {
  return variant === 'instant'
    ? `${machineName}를 바로 이용할 수 있어요. 10분 안에 QR을 찍어주세요.`
    : `${machineName} 차례가 됐어요! 10분 안에 QR을 찍어 시작해주세요.`;
}

export function usageEndedTitle(machineName: string): string {
  return `${machineName} 사용이 끝났어요`;
}

export function usageEndedBody(machineName: string): string {
  return `${machineName} 이용 시간이 끝났어요. 3분 안에 "다했어요"를 눌러주세요.`;
}
