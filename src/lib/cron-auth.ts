// cron 라우트 공용 인증 (08 · 4번 · 9번).
//
// 원래 src/app/api/cron/cleanup/route.ts 안에만 있던 authorized() 를 그대로 꺼냈다 —
// Issue #8 이 만료 스케줄러 라우트(/api/cron/expiration)를 하나 더 만들면서, 두
// 라우트가 각자 같은 검사를 베껴 두면 한쪽만 고쳐질 수 있기 때문이다. 검사 내용은
// 바뀌지 않았다.
//
// 부르는 곳:
//   · GET /api/cron/cleanup     — 하루 1회 보관 기간 정리 (05 P23 · P24 · SP4)
//   · GET /api/cron/expiration  — 만료 스케줄러 (05 P3 · P5 · P7 · 08 · 4번)
//
// 둘 다 같은 CRON_SECRET 을 쓴다. 값은 .env.local.example 에 설명과 함께 있다.

import { timingSafeEqual } from 'node:crypto';

/**
 * `Authorization: Bearer <CRON_SECRET>` 를 확인한다.
 *
 * **CRON_SECRET 이 설정되지 않았으면 열지 않고 막는다.** 비어 있을 때 통과시키면
 * 환경변수를 깜빡한 배포에서 누구나 이 라우트를 부를 수 있게 된다 — 정리 배치는
 * 사람을 지우고(05 P24), 만료 스케줄러는 경고를 매긴다(05 P3 · P5).
 *
 * 비교는 timingSafeEqual 로 한다. 길이가 다르면 timingSafeEqual 이 예외를 던지므로
 * 먼저 길이를 본다(길이는 비밀이 아니다).
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;

  const given = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
