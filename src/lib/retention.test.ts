// src/lib/retention.ts 의 보관 기간 판정을 확인한다 (05 「보관 기간과 조회 기간」).
//
// 실행: npm test
//
// report-rules.test.ts 와 같은 방식이다 — Node 내장 테스트 러너(node:test)와 타입
// 스트리핑만 쓰고, `@/` 별칭 대신 상대 경로로 불러온다(별칭은 번들러가 푸는 것이라
// node 가 직접 돌릴 때는 없다).
//
// **여기서 확인하는 것은 DB 없이 판정되는 「기간」뿐이다.** 실제 DELETE · CASCADE ·
// 남의 데이터가 지워지지 않는지는 DB 가 있어야 해서 이 파일에 없다 — 08 · 9번의
// 수동 확인 절차를 따른다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  daysAgo,
  isExpired,
  monthsAgo,
  noticeCutoff,
  notificationCutoffs,
  reportCutoff,
  usageHistoryCutoff,
  verificationCutoff,
  warningCutoff,
  withdrawPurgeCutoff,
  NOTIFICATION_RETENTION_DAYS,
  WARNING_RETENTION_MONTHS,
  WITHDRAW_GRACE_DAYS,
} from './retention.ts';

/** 판정 기준 시각을 고정한다 — 오늘이 언제든 같은 결과가 나와야 한다 */
const NOW = new Date('2026-09-16T12:00:00.000Z');

/** NOW 에서 n 일 전에 생긴 것 */
function daysOld(n: number): Date {
  return daysAgo(NOW, n);
}

/** NOW 에서 n 개월 전에 생긴 것 */
function monthsOld(n: number): Date {
  return monthsAgo(NOW, n);
}

describe('05 P14 — 알림은 30일, 「공지」 종류만 3개월', () => {
  const { other, notice } = notificationCutoffs(NOW);

  it('29일 된 일반 알림은 남는다', () => {
    assert.equal(isExpired(daysOld(29), other), false);
  });

  it('30일이 지난 일반 알림은 삭제 대상이다 (경계 포함)', () => {
    assert.equal(isExpired(daysOld(30), other), true);
  });

  it('31일 된 일반 알림은 삭제 대상이다', () => {
    assert.equal(isExpired(daysOld(31), other), true);
  });

  it('30일이 지난 「공지」 알림은 아직 남는다 — 공지만 3개월이다', () => {
    assert.equal(isExpired(daysOld(31), notice), false);
  });

  it('3개월이 안 된 공지 알림은 남는다', () => {
    assert.equal(isExpired(daysOld(80), notice), false);
  });

  it('3개월이 지난 공지 알림은 삭제 대상이다', () => {
    assert.equal(isExpired(monthsOld(3), notice), true);
  });

  it('공지 컷오프가 일반 컷오프보다 반드시 과거다 — 공지를 먼저 지우면 안 된다', () => {
    assert.ok(notice.getTime() < other.getTime());
  });

  it('상수는 05 P14 의 30일 그대로다', () => {
    assert.equal(NOTIFICATION_RETENTION_DAYS, 30);
  });
});

describe('05 P18 — 공지 원본은 등록 후 3개월', () => {
  const cutoff = noticeCutoff(NOW);

  it('3개월이 안 된 공지는 남는다', () => {
    assert.equal(isExpired(daysOld(80), cutoff), false);
  });

  it('3개월이 지난 공지는 삭제 대상이다', () => {
    assert.equal(isExpired(monthsOld(3), cutoff), true);
  });

  it('공지 원본과 공지 알림의 기간이 같다 — 어느 쪽도 먼저 사라지지 않는다', () => {
    assert.equal(cutoff.getTime(), notificationCutoffs(NOW).notice.getTime());
  });
});

describe('05 P17 · SP4 — 이용 내역 · 신고는 3개월', () => {
  it('3개월이 안 된 이용 내역은 남는다', () => {
    assert.equal(isExpired(daysOld(80), usageHistoryCutoff(NOW)), false);
  });

  it('3개월이 지난 이용 내역은 삭제 대상이다', () => {
    assert.equal(isExpired(monthsOld(3), usageHistoryCutoff(NOW)), true);
  });

  it('3개월이 안 된 신고는 남는다', () => {
    assert.equal(isExpired(daysOld(80), reportCutoff(NOW)), false);
  });

  it('3개월이 지난 신고는 삭제 대상이다', () => {
    assert.equal(isExpired(monthsOld(3), reportCutoff(NOW)), true);
  });

  it('사생 조회 30일보다 보관이 길다 — 조회가 보관보다 길 수 없다 (05 P21)', () => {
    // 기록 화면은 30일만 보여주고(P21), 보관은 3개월이다(SP4).
    assert.ok(usageHistoryCutoff(NOW).getTime() < daysAgo(NOW, 30).getTime());
  });
});

describe('05 SP4 — 경고 기록은 1개월(2026-09-17: 3개월에서 축소)', () => {
  it('상수가 1개월이다', () => {
    assert.equal(WARNING_RETENTION_MONTHS, 1);
  });

  it('29일 된 경고 기록은 남는다', () => {
    assert.equal(isExpired(daysOld(29), warningCutoff(NOW)), false);
  });

  it('1개월이 지난 경고 기록은 삭제 대상이다 (경계 포함)', () => {
    assert.equal(isExpired(monthsOld(1), warningCutoff(NOW)), true);
  });

  it('경고 보관은 이용 내역 · 신고보다 짧다 — 경고만 1개월로 따로 줄었다', () => {
    assert.ok(warningCutoff(NOW).getTime() > usageHistoryCutoff(NOW).getTime());
    assert.ok(warningCutoff(NOW).getTime() > reportCutoff(NOW).getTime());
  });

  it('경계값 — 딱 1개월 전에 받은 경고는 그 시각 이전엔 남고 그 시각부터는 삭제 대상이다', () => {
    // 이슈 예시: 2026-08-17 10:00 경고 → 2026-09-17 09:59 실행이면 유지, 10:00 실행이면 삭제.
    const issuedAt = new Date('2026-08-17T10:00:00.000Z');
    const oneMinuteBeforeCutoff = new Date('2026-09-17T09:59:00.000Z');
    const atCutoff = new Date('2026-09-17T10:00:00.000Z');

    assert.equal(isExpired(issuedAt, warningCutoff(oneMinuteBeforeCutoff)), false);
    assert.equal(isExpired(issuedAt, warningCutoff(atCutoff)), true);
  });
});

describe('05 P24 — 탈퇴는 신청 + 14일', () => {
  const cutoff = withdrawPurgeCutoff(NOW);

  it('13일 전에 신청한 계정은 아직 지우지 않는다', () => {
    assert.equal(isExpired(daysOld(13), cutoff), false);
  });

  it('14일이 지난 계정은 삭제 대상이다 (경계 포함)', () => {
    assert.equal(isExpired(daysOld(14), cutoff), true);
  });

  it('15일이 지난 계정도 삭제 대상이다', () => {
    assert.equal(isExpired(daysOld(15), cutoff), true);
  });

  it('방금 신청한 계정은 지우지 않는다', () => {
    assert.equal(isExpired(NOW, cutoff), false);
  });

  it('상수는 05 P24 의 14일 그대로다', () => {
    assert.equal(WITHDRAW_GRACE_DAYS, 14);
  });
});

describe('만료된 이메일 인증코드 — 티켓 창을 넘어선 뒤에 지운다', () => {
  const cutoff = verificationCutoff(NOW);

  it('방금 만료된 코드는 아직 지우지 않는다 — 인증을 마친 표가 10분 살아 있다', () => {
    const justExpired = new Date(NOW.getTime() - 60 * 1000);
    assert.equal(isExpired(justExpired, cutoff), false);
  });

  it('30분 전에 만료된 코드도 아직 지우지 않는다', () => {
    const halfHourAgo = new Date(NOW.getTime() - 30 * 60 * 1000);
    assert.equal(isExpired(halfHourAgo, cutoff), false);
  });

  it('하루가 지난 코드는 삭제 대상이다', () => {
    assert.equal(isExpired(daysOld(1), cutoff), true);
  });

  it('여유가 티켓 창(10분)보다 넉넉히 길다', () => {
    const graceMs = NOW.getTime() - cutoff.getTime();
    assert.ok(graceMs > 10 * 60 * 1000);
  });
});

describe('monthsAgo — Postgres interval 과 같게 센다', () => {
  it('월말이 넘치지 않는다 — 5/31 의 3개월 전은 3월이 아니라 2월이다', () => {
    // JS 의 setMonth 를 그냥 쓰면 2/31 이 없어 3/3 으로 넘친다.
    const at = monthsAgo(new Date('2026-05-31T00:00:00.000Z'), 3);
    assert.equal(at.getMonth(), 1); // 2월 (0-based)
    assert.equal(at.getDate(), 28); // 2026 은 평년
  });

  it('윤년에는 2/29 로 끌어당긴다', () => {
    const at = monthsAgo(new Date('2024-05-31T00:00:00.000Z'), 3);
    assert.equal(at.getMonth(), 1);
    assert.equal(at.getDate(), 29);
  });

  it('넘칠 일이 없는 날짜는 그대로 옮긴다', () => {
    const at = monthsAgo(new Date('2026-09-16T00:00:00.000Z'), 3);
    assert.equal(at.getFullYear(), 2026);
    assert.equal(at.getMonth(), 5); // 6월
    assert.equal(at.getDate(), 16);
  });

  it('해를 넘어가도 맞다', () => {
    const at = monthsAgo(new Date('2026-02-16T00:00:00.000Z'), 3);
    assert.equal(at.getFullYear(), 2025);
    assert.equal(at.getMonth(), 10); // 11월
    assert.equal(at.getDate(), 16);
  });

  it('시각은 그대로 둔다 — 날짜만 옮긴다', () => {
    const source = new Date('2026-09-16T12:34:56.789Z');
    const at = monthsAgo(source, 3);
    assert.equal(at.getHours(), source.getHours());
    assert.equal(at.getMinutes(), source.getMinutes());
    assert.equal(at.getSeconds(), source.getSeconds());
  });

  it('원본 Date 를 바꾸지 않는다', () => {
    const source = new Date('2026-09-16T12:00:00.000Z');
    const before = source.getTime();
    monthsAgo(source, 3);
    daysAgo(source, 30);
    assert.equal(source.getTime(), before);
  });
});
