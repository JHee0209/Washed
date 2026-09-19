// 보관 기간이 지난 것을 **실제로 지우는** 자리 (05 P14 · P17 · P18 · P23 · P24 · SP4 ·
// 08 · 9번).
//
// 08 · 9번: 「지금은 어느 것도 실제로 지워지지 않는다. 화면에서 거를 뿐이다」
//
// 이 파일이 그 문장을 끝낸다. 05 의 「보관 기간과 조회 기간」 대조표에서 **보관** 축에
// 적힌 것을 전부 여기서 지운다. **조회** 축(사생 30일 · 관리자 3개월)은 각 조회 함수에
// 그대로 남는다 — 보여주는 규칙과 지우는 규칙은 다른 층이다.
//
// ── 구조
// runDailyCleanup() 은 **부르기만 한다.** 단계마다 함수를 따로 두어 무엇이 어떤 근거로
// 지워지는지 한 눈에 보이게 하고, 한 단계가 실패해도 나머지가 돌게 try/catch 를 나눈다
// — 사진 정리가 막혔다고 탈퇴 정리까지 멈추면 P24 의 「14일」이 조용히 늘어난다.
//
// ── 순서
// 자식부터 지우고 사용자는 맨 마지막이다. 기간이 지난 것들을 먼저 치워야 탈퇴 정리가
// 훑을 양이 줄고, users 를 먼저 지우면 FK 가 걸린다(전부 ON DELETE CASCADE 라 실제로
// 터지지는 않지만, CASCADE 에 기대지 않는 순서를 둔다 — 작업 지시 8번).
//
// 부르는 곳은 src/app/api/cron/cleanup/route.ts 하나이고, vercel.json 이 그 라우트를
// 하루 한 번 부른다.

import 'server-only';

import { sql } from '@/lib/db';
import {
  deleteEvidenceForExpiredReports,
  deleteEvidenceForWithdrawnUsers,
  deleteExpiredEvidence,
} from '@/lib/evidence-storage';
import { resetMonthlyWarnings } from '@/lib/expiration';
import {
  noticeCutoff,
  notificationCutoffs,
  reportCutoff,
  usageHistoryCutoff,
  verificationCutoff,
  warningCutoff,
  withdrawPurgeCutoff,
} from '@/lib/retention';
import { runExpirationSweep } from '@/lib/scheduler';

export type CleanupResult = {
  /** 05 P23 — 보관 기간이 지나 지운 증거 사진 장수 */
  expiredEvidence: number;
  /** 05 P23 · SP4 — 3개월이 지나 지운 신고 건수 */
  expiredReports: number;
  /** 05 P23 · SP4 — 그 신고들에 딸려 있던 사진 장수 */
  expiredReportEvidence: number;
  /** 05 P17 · SP4 — 3개월이 지나 지운 이용 내역 건수 */
  expiredUsageHistory: number;
  /** 05 SP4 — 1개월이 지나 지운 경고 기록 건수 */
  expiredWarnings: number;
  /** 05 P18 — 3개월이 지나 지운 공지 건수 */
  expiredNotices: number;
  /** 05 P14 — 보관 기간이 지나 지운 알림 건수 (일반 30일 · 공지 3개월) */
  expiredNotifications: number;
  /** 만료된 이메일 인증코드 건수 */
  expiredVerifications: number;
  /** 05 P24 — 유예 기간이 끝나 지운 계정 수 */
  purgedUsers: number;
  /** 그 계정들이 올렸던 증거 사진 장수 (purgedUsers 에 딸린 값) */
  purgedUserEvidence: number;
  /** 05 P7 — 3일 제한이 끝나 경고 0회로 자동 해제된 사람 수 */
  liftedRestrictions: number;
  /** 05 P7 — 매달 1일(KST)에 경고 0회로 초기화된 사람 수. 그날이 아니면 0 */
  monthlyWarningReset: number;
  /**
   * 05 P3 — 10분 안에 QR 인증이 없어 배정이 풀리고 경고가 매겨진 건수.
   *
   * 이 배치는 **백스톱일 뿐**이다 — Issue #8 이후로는 주기 스케줄러
   * (GET /api/cron/expiration)가 상시 훑고, POST /api/queue/[kind] 도 줄서기 때마다
   * 먼저 훑는다. 이 값은 그 둘이 모두 놓쳤을 때만 의미를 갖는다.
   */
  expiredAssignments: number;
  /**
   * 05 P5 · F9 — 사용 타이머가 끝나 수거대기로 넘어간 건수(백스톱). 위와 같다.
   */
  startedPickupWaits: number;
  /**
   * 05 P5 — 수거대기 3분을 넘겨 강제 종료·경고가 매겨진 건수(백스톱). 위와 같다.
   */
  expiredPickups: number;
  /**
   * 05 P2 — 위 만료로 풀린 기기에 FIFO 로 새로 배정된 사람 수.
   *
   * Issue #8 이전에는 이 배치가 기기를 풀어 놓고도 다음 사람을 배정하지 않았다
   * (drainQueue() 호출부에 이 파일이 없었다). 이제 runExpirationSweep() 이
   * 그 걸음까지 함께 돈다.
   */
  assignedNext: number;
  /** 실패한 단계의 이름. 비어 있으면 전부 성공이다 */
  failed: string[];
};

/**
 * 05 P23 · SP4 — 접수한 지 3개월이 지난 신고를 지운다.
 *
 * 「신고(증거 사진 포함)는 분쟁 처리를 위해 3개월간 보관하며, 3개월이 지나거나 탈퇴 후
 * 14일이 지나거나 둘 중 먼저 오는 때에 영구 파기한다」(SP4).
 *
 * **상태를 가리지 않는다** — 접수됨 · 처리중도 함께 지운다(팀 확정). SP4 가 상태가
 * 아니라 시각만으로 기간을 정했고, 미처리 건을 남겨 두면 개인정보가 무기한 남는다.
 * 3개월 동안 처리되지 않은 신고는 관리자 화면에서도 이미 볼 수 없게 된다.
 *
 * 사진을 **먼저** 지운다 — 저장소 층이 그 순서를 안다(evidence-storage.ts).
 */
export async function deleteExpiredReports(
  now: Date = new Date(),
): Promise<{ reports: number; evidence: number }> {
  const cutoff = reportCutoff(now);

  // ① 파일 먼저 (외부 저장소로 바뀌어도 부르는 쪽은 그대로다)
  const evidence = await deleteEvidenceForExpiredReports(cutoff);

  // ② 그 다음 신고. 남은 report_evidence 는 CASCADE 로 함께 사라진다.
  const rows = await sql<{ report_id: string }>`
    DELETE FROM reports
     WHERE created_at <= ${cutoff.toISOString()}::timestamptz
    RETURNING report_id
  `;

  return { reports: rows.length, evidence };
}

/**
 * 05 P17 · SP4 — 3개월이 지난 이용 내역을 지운다.
 *
 * 「이용 내역은 최근 3개월까지만 조회할 수 있고, 그 이전 내역은 보관하지 않는다」(P17).
 * 기산점은 started_at 이다 — 06 「이용 내역」이 그 이용이 **일어난** 시각으로 기간을
 * 세고, 조회 필터(queries.ts · admin-actions.ts)도 같은 칸을 본다.
 */
export async function deleteExpiredUsageHistory(now: Date = new Date()): Promise<number> {
  const rows = await sql<{ history_id: string }>`
    DELETE FROM usage_history
     WHERE started_at <= ${usageHistoryCutoff(now).toISOString()}::timestamptz
    RETURNING history_id
  `;
  return rows.length;
}

/**
 * 05 SP4 — 1개월이 지난 경고 **기록**(사유 · 시각)을 지운다(2026-09-17: 3개월 → 1개월).
 *
 * **usage_restrictions 는 건드리지 않는다.** 05 의 대조표에서 「경고 누적 횟수 · 이용
 * 제한」은 보관 칸이 「지우지 않는다 — 0회로 되돌린다」이다(P7). 제한 3일이 끝날 때와
 * 매달 1일에 0으로 되돌아가는 값이라, 기간이 지났다고 지우면 제재가 사라진다.
 * 여기서 지우는 것은 「무슨 사유로 언제 받았는지」의 기록뿐이다.
 */
export async function deleteExpiredWarnings(now: Date = new Date()): Promise<number> {
  const rows = await sql<{ warning_id: string }>`
    DELETE FROM warnings
     WHERE issued_at <= ${warningCutoff(now).toISOString()}::timestamptz
    RETURNING warning_id
  `;
  return rows.length;
}

/**
 * 05 P18 — 등록한 지 3개월이 지난 공지를 지운다.
 *
 * 「등록한 지 3개월이 지난 공지는 삭제한다 — 지난 학기 공지가 쌓여 지금 공지를 가리지
 * 않게 하기 위해서다.」
 *
 * 딸린 알림함 줄은 notifications.notice_id 의 ON DELETE CASCADE(0004)가 함께 데려간다
 * — removeNotice() 가 기대는 것과 같은 연결이다.
 */
export async function deleteExpiredNotices(now: Date = new Date()): Promise<number> {
  const rows = await sql<{ notice_id: string }>`
    DELETE FROM notices
     WHERE created_at <= ${noticeCutoff(now).toISOString()}::timestamptz
    RETURNING notice_id
  `;
  return rows.length;
}

/**
 * 05 P14 — 보관 기간이 지난 알림을 지운다. **종류마다 기간이 다르다.**
 *
 *   배정 · 종료 · 경고 · 결과 … 30일
 *   공지 ……………………………… 3개월 (공지 원본이 3개월 남으므로 · P18 의 예외)
 *
 * 30일 하나로 자르면 아직 살아 있는 공지를 사생만 못 보게 된다. 한 문장 안에서 CASE 로
 * 가른다 — 두 번 도는 것보다 왕복이 적고, 두 기간이 한 자리에 붙어 있어 나중에 한쪽만
 * 고치는 실수가 나지 않는다.
 *
 * 공지 알림은 대개 위의 deleteExpiredNotices() 가 CASCADE 로 이미 데려갔다. 이 단계는
 * **notice_id 가 비어 있는 공지 알림**까지 훑는 안전망이다.
 */
export async function deleteExpiredNotifications(now: Date = new Date()): Promise<number> {
  const { other, notice } = notificationCutoffs(now);

  const rows = await sql<{ notification_id: string }>`
    DELETE FROM notifications
     WHERE received_at <= CASE WHEN kind = '공지'
                               THEN ${notice.toISOString()}::timestamptz
                               ELSE ${other.toISOString()}::timestamptz
                          END
    RETURNING notification_id
  `;
  return rows.length;
}

/**
 * 만료된 이메일 인증코드를 지운다 (08 · 1번 「아직 남은 것」 ④).
 *
 * ── 왜 expires_at 만 보고 지우지 않는가
 * ① 인증을 마친 줄은 expires_at 이 지난 뒤에도 **10분 동안 일회용 표를 받는다**
 *    (verification.ts 의 consumeTicket). 코드 유효 시간은 3분인데 가입 폼을 채우는 데
 *    그보다 오래 걸리기 때문이다. 그 창에 배치가 걸리면 가입이 통째로 깨진다.
 * ② invalidateCode() 는 「최신 줄을 지우면 직전 코드가 되살아난다」는 이유로 줄을
 *    지우지 않고 만료시각만 당겨 둔다.
 *
 * 그래서 **만료 + 하루**가 지난 줄만, 그리고 인증을 마친 줄이라면 **인증한 지도**
 * 하루가 지난 것만 지운다. 만료된 줄을 같은 기준으로 한꺼번에 지우므로 ②의 되살아나는
 * 줄도 생기지 않는다.
 */
export async function deleteExpiredVerifications(now: Date = new Date()): Promise<number> {
  const cutoff = verificationCutoff(now).toISOString();

  const rows = await sql<{ verification_id: string }>`
    DELETE FROM email_verifications
     WHERE expires_at <= ${cutoff}::timestamptz
       AND (verified_at IS NULL OR verified_at <= ${cutoff}::timestamptz)
    RETURNING verification_id
  `;
  return rows.length;
}

/**
 * 05 P24 — 탈퇴 신청 후 14일이 지난 계정을 지운다.
 *
 * 08 · 9번: 「탈퇴는 즉시 삭제가 아니라 14일 유예다 — 탈퇴 신청 시각을 저장하고,
 * 매일 배치로 `탈퇴 신청 + 14일` 이 지난 계정의 개인정보 · 이용 내역 · 경고 · 신고 ·
 * 알림 · 올린 사진을 삭제한다. **익명화가 아니라 삭제다.**」
 *
 * ── 순서가 중요하다
 * 사진을 **먼저** 지우고 그 다음에 계정을 지운다. 지금 저장소에서는 users → reports →
 * report_evidence 가 전부 ON DELETE CASCADE 라 계정만 지워도 파일이 함께 사라지지만,
 * 외부 저장소(S3 등)로 옮기면 DB 행은 CASCADE 로 사라져도 **파일은 그대로 남는다.**
 * 그때 고칠 곳이 없도록 지금부터 이 순서로 둔다.
 * (05 P23 도 「신고자가 탈퇴하면 그 전이라도 함께 삭제한다」로 같은 것을 요구한다.)
 *
 * ── 계정을 지우면 함께 사라지는 것 (db/schema.sql 의 ON DELETE CASCADE)
 * 줄서기 · 경고 · 이용 제한 · 신고 · 알림 · 이용 내역 · 푸시 구독. 05 의 대조표가
 * 「계정을 지우면 그 사람의 … 이 함께 사라진다」로 열거한 것과 같은 목록이다.
 *
 * ── 사람마다 돌지 않는다
 * 두 문장이면 몇 명이든 끝난다(작업 지시 14번). 조건을 두 문장에 똑같이 걸어 두어,
 * 사이에 누가 복구하더라도 그 계정은 어느 쪽에도 걸리지 않는다.
 */
export async function purgeWithdrawnUsers(
  now: Date = new Date(),
): Promise<{ users: number; evidence: number }> {
  const cutoff = withdrawPurgeCutoff(now);

  // ① 파일 먼저 (저장소 층이 안다 — 외부 저장소로 바뀌어도 여기는 그대로다)
  const evidence = await deleteEvidenceForWithdrawnUsers(cutoff);

  // ② 그 다음 계정. 딸린 기록은 CASCADE 로 함께 사라진다.
  const deleted = await sql<{ user_id: string }>`
    DELETE FROM users
     WHERE withdraw_requested_at IS NOT NULL
       AND withdraw_requested_at <= ${cutoff.toISOString()}::timestamptz
    RETURNING user_id
  `;

  return { users: deleted.length, evidence };
}

/**
 * 하루 한 번 도는 일 (05 P14 · P17 · P18 · P23 · P24 · SP4).
 *
 * 한 단계가 실패해도 다음 단계는 돈다 — 한 곳이 막혔다고 나머지 보관 기간이 조용히
 * 늘어나면 안 된다. 실패한 단계 이름은 failed 에 모아 라우트가 500 으로 알린다.
 */
export async function runDailyCleanup(now: Date = new Date()): Promise<CleanupResult> {
  const result: CleanupResult = {
    expiredEvidence: 0,
    expiredReports: 0,
    expiredReportEvidence: 0,
    expiredUsageHistory: 0,
    expiredWarnings: 0,
    expiredNotices: 0,
    expiredNotifications: 0,
    expiredVerifications: 0,
    purgedUsers: 0,
    purgedUserEvidence: 0,
    liftedRestrictions: 0,
    monthlyWarningReset: 0,
    expiredAssignments: 0,
    startedPickupWaits: 0,
    expiredPickups: 0,
    assignedNext: 0,
    failed: [],
  };

  /** 한 단계를 돌린다. 실패하면 이름만 남기고 다음으로 넘어간다. */
  async function step(name: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      console.error(`정리 배치 단계 실패: ${name}`, error);
      result.failed.push(name);
    }
  }

  // 05 P23 — 올린 지 3개월이 지난 증거 사진. 신고 기록은 남고 사진만 사라진다.
  await step('expiredEvidence', async () => {
    result.expiredEvidence = await deleteExpiredEvidence(now);
  });

  // 05 P23 · SP4 — 접수한 지 3개월이 지난 신고 (사진 먼저, 그 다음 신고)
  await step('expiredReports', async () => {
    const purged = await deleteExpiredReports(now);
    result.expiredReports = purged.reports;
    result.expiredReportEvidence = purged.evidence;
  });

  // 05 P17 · SP4 — 3개월이 지난 이용 내역
  await step('expiredUsageHistory', async () => {
    result.expiredUsageHistory = await deleteExpiredUsageHistory(now);
  });

  // 05 SP4 — 1개월이 지난 경고 기록 (누적 횟수 · 이용 제한은 건드리지 않는다)
  await step('expiredWarnings', async () => {
    result.expiredWarnings = await deleteExpiredWarnings(now);
  });

  // 05 P18 — 등록한 지 3개월이 지난 공지. 딸린 알림은 CASCADE 로 함께 사라진다.
  // 아래 알림 단계보다 **먼저** 돈다 — 그래야 공지에서 나온 줄이 한 번에 정리된다.
  await step('expiredNotices', async () => {
    result.expiredNotices = await deleteExpiredNotices(now);
  });

  // 05 P14 — 알림 30일 · 「공지」 종류만 3개월
  await step('expiredNotifications', async () => {
    result.expiredNotifications = await deleteExpiredNotifications(now);
  });

  // 08 · 1번 — 만료된 이메일 인증코드
  await step('expiredVerifications', async () => {
    result.expiredVerifications = await deleteExpiredVerifications(now);
  });

  // 05 P24 — 탈퇴 유예가 끝난 계정. **맨 마지막이다** — 계정을 지우면 위의 것들이
  // CASCADE 로 함께 사라지므로, 먼저 돌면 앞 단계가 셀 것이 사라져 집계가 흐려진다.
  await step('purgedUsers', async () => {
    const purged = await purgeWithdrawnUsers(now);
    result.purgedUsers = purged.users;
    result.purgedUserEvidence = purged.evidence;
  });

  // 05 P3 · P5 · P7 — 만료 스윕의 **백스톱**이다. Issue #8 이후로는 주기 스케줄러
  // (GET /api/cron/expiration)가 상시 돌고, POST /api/queue/[kind] 도 줄서기 때마다
  // 훑으므로 이 단계는 그 둘이 모두 놓쳤을 때만 의미가 있다.
  //
  // **순서를 여기 다시 적지 않는다** — 단계와 그 이유는 scheduler.ts 의
  // runExpirationSweep() 한 곳에만 있다. 예전에는 이 파일이 같은 순서를 따로
  // 나열하고 있어서 한쪽만 고쳐질 위험이 있었다(#34 가 expireRunTimers() 에 했던
  // 정리와 같은 이유). 실패한 단계 이름은 그쪽에서 모아 오므로 그대로 합친다.
  const sweep = await runExpirationSweep(now);
  result.expiredAssignments = sweep.expiredAssignments;
  result.startedPickupWaits = sweep.startedPickupWaits;
  result.expiredPickups = sweep.expiredPickups;
  result.assignedNext = sweep.assignedNext;
  result.liftedRestrictions = sweep.liftedRestrictions;
  result.failed.push(...sweep.failed);

  // 05 P7 — 매달 1일(KST). 그날이 아니면 0을 돌려주고 아무것도 바꾸지 않는다.
  //
  // **이것만 위 스윕에 넣지 않았다.** P7 의 "매달 1일 초기화" 는 하루 1회를 뜻하는데,
  // runExpirationSweep() 은 분 단위로도 돌 수 있어서 거기 넣으면 1일 하루 내내 매
  // 회차마다 누적을 0 으로 밀어 **그날 새로 쌓인 경고까지 지워 버린다.** 하루 한 번
  // 도는 이 배치가 제자리다(18:00 UTC = 한국 03:00 → isFirstOfMonthInKst 가 참).
  try {
    result.monthlyWarningReset = await resetMonthlyWarnings(now);
  } catch (error) {
    console.error('매달 1일 경고 초기화 실패', error);
    result.failed.push('monthlyWarningReset');
  }

  return result;
}
