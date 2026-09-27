// 가입 코드 발송 열거 차단 · 신고 증거 사진 매직 넘버 검증 회귀 테스트.
//
// profile-password-photo.test.ts 와 같은 하네스(PGlite + @/auth 스텁)를 쓴다.
// 라우트 핸들러를 production 코드 그대로 직접 부른다.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { POST as sendSignupCode } from '../app/api/auth/signup/send-code/route.ts';
import { POST as postReport } from '../app/api/reports/route.ts';
import { createTestDb, seedUser } from '../../test/db-harness.mjs';
import { loginAs, setTestSession } from '../../test/stubs/auth.mjs';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function callSendCode(email: string) {
  const res = await sendSignupCode(
    new Request('http://test/api/auth/signup/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  );
  const body = (await res.json()) as Record<string, unknown>;
  // devCode 는 개발 편의용이라 비교에서 뺀다 (운영에서는 절대 나가지 않는다)
  const hasDevCode = 'devCode' in body;
  delete body.devCode;
  return { status: res.status, body, hasDevCode };
}

async function codeRows(db: TestDb, email: string): Promise<number> {
  const rows = (await db.query('SELECT 1 FROM email_verifications WHERE email = $1', [email])) as unknown[];
  return rows.length;
}

describe('회원가입 인증코드 발송 — 가입 여부와 무관한 동일 응답', () => {
  let db: TestDb;
  const registered = 'issue58-signup-registered@test.ac.kr';
  const withdrawing = 'issue58-signup-withdrawing@test.ac.kr';
  const fresh = 'brand-new-student@test.ac.kr';

  before(async () => {
    db = await createTestDb();
    await seedUser(db, 'signup-registered');
    const withdrawId = await seedUser(db, 'signup-withdrawing');
    await db.query('UPDATE users SET withdraw_requested_at = now() WHERE user_id = $1', [withdrawId]);
  });

  after(async () => {
    await db.close();
  });

  it('미가입 · 가입 · 탈퇴 대기 이메일이 같은 상태코드와 같은 본문을 받는다', async () => {
    const a = await callSendCode(fresh);
    const b = await callSendCode(registered);
    const c = await callSendCode(withdrawing);

    assert.equal(a.status, 200);
    assert.deepEqual(b, { ...a, hasDevCode: false });
    assert.deepEqual(c, { ...a, hasDevCode: false });
    assert.deepEqual(a.body, { ok: true, minutes: 5 });
  });

  it('가입된 이메일 · 탈퇴 대기 이메일로는 코드가 만들어지지 않는다', async () => {
    assert.equal(await codeRows(db, registered), 0);
    assert.equal(await codeRows(db, withdrawing), 0);
    assert.equal(await codeRows(db, fresh), 1);
  });

  it('쿨다운 중 재요청도 429 가 아니라 같은 성공 응답이다 (재요청으로 가입 여부를 가르지 못한다)', async () => {
    const again = await callSendCode(fresh);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, { ok: true, minutes: 5 });
    assert.equal(await codeRows(db, fresh), 1);
  });
});

// 매직 넘버만 본다 — 완전한 이미지일 필요는 없다.
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const HTML_BYTES = Buffer.from('<html><script>alert(1)</script></html>');

async function submitLaundryReport(bytes: Buffer, type: string) {
  const form = new FormData();
  form.append('reason', '세탁물이 있어요');
  form.append('machineKind', '세탁기');
  form.append('machineNo', '1');
  form.append('evidence', new File([new Uint8Array(bytes)], 'evidence.jpg', { type }));
  const res = await postReport(new Request('http://test/api/reports', { method: 'POST', body: form }));
  return { status: res.status, body: (await res.json()) as { ok: boolean; reportId?: string; code?: string } };
}

describe('신고 증거 사진 — 매직 넘버 검증', () => {
  let db: TestDb;

  before(async () => {
    db = await createTestDb();
    loginAs(await seedUser(db, 'reporter'));
  });

  after(async () => {
    setTestSession(null);
    await db.close();
  });

  it('진짜 JPEG 바이트는 접수된다', async () => {
    const { status, body } = await submitLaundryReport(JPEG_HEADER, 'image/jpeg');
    assert.equal(status, 201);
    assert.equal(body.ok, true);
  });

  it('Content-Type 을 image/jpeg 로 속인 HTML 은 415 로 거절된다', async () => {
    const { status, body } = await submitLaundryReport(HTML_BYTES, 'image/jpeg');
    assert.equal(status, 415);
    assert.equal(body.code, 'IMAGE_TYPE_NOT_ALLOWED');
  });

  it('저장되는 mime_type 은 브라우저가 말한 값이 아니라 판정된 값이다', async () => {
    const { status, body } = await submitLaundryReport(PNG_HEADER, 'image/jpeg');
    assert.equal(status, 201);
    const rows = (await db.query('SELECT mime_type FROM report_evidence WHERE report_id = $1', [
      body.reportId,
    ])) as { mime_type: string }[];
    assert.equal(rows[0]?.mime_type, 'image/png');
  });
});
