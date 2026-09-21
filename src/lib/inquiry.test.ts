// 문의 접수 → 관리자 조회 (F21 · 05 SP8 · Issue #86).
//
// POST /api/support 라우트와 adminInquiries() 서버 액션을 **진짜 모듈 그대로** 부른다.
// DB 는 PGlite(test/db-harness.mjs)이고, 세션과 Next 배관(쿠키 · redirect)만 스텁이다.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { POST as supportPost } from '../app/api/support/route.ts';
import { adminInquiries } from './admin-actions.ts';
import { adminSignIn } from './admin-session.ts';
import { hash } from './hash.ts';
import { MAX_INQUIRY_LENGTH } from './inquiry-rules.ts';
import { createTestDb, seedUser } from '../../test/db-harness.mjs';
import { loginAs, setTestSession } from '../../test/stubs/auth.mjs';
import { clearTestCookies } from '../../test/stubs/headers.mjs';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
type RouteResult = { status: number; body: Record<string, unknown> };
type InquiryRow = { inquiry_id: string; user_id: string; content: string; created_at: string };

process.env.AUTH_SECRET = 'issue86-inquiry-test-secret';

const ADMIN_LOGIN_ID = 'issue86-admin';
const ADMIN_PASSWORD = 'issue86-admin-password';

/** 라우트를 부른다. body 를 그대로 실어 보낸다 — 위조 시도도 이 길로 들어온다. */
async function submit(body: unknown): Promise<RouteResult> {
  const res = await supportPost(
    new Request('http://test/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function inquiryRows(db: TestDb): Promise<InquiryRow[]> {
  return (await db.query(
    'SELECT inquiry_id, user_id, content, created_at FROM inquiries ORDER BY created_at, inquiry_id',
  )) as InquiryRow[];
}

describe('문의 접수 (POST /api/support)', () => {
  let db: TestDb;
  let userA: string;
  let userB: string;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'inquiry-a');
    userB = await seedUser(db, 'inquiry-b');
  });

  after(async () => {
    await db.close();
  });

  it('로그인한 사용자의 문의가 저장된다', async () => {
    loginAs(userA);
    const res = await submit({ content: '  세탁기 3호기가 계속 멈춰요.  ' });

    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.inquiryId, 'string');

    const rows = await inquiryRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, userA);
    // 앞뒤 공백은 떼고 들어간다
    assert.equal(rows[0].content, '세탁기 3호기가 계속 멈춰요.');
  });

  it('본문에 남의 user_id 를 실어 보내도 세션 사용자로 저장된다', async () => {
    loginAs(userB);
    const res = await submit({ content: '건조기 문이 안 닫혀요.', user_id: userA, userId: userA });

    assert.equal(res.status, 201);

    const rows = await inquiryRows(db);
    assert.equal(rows.length, 2);
    const stored = rows.find((r) => r.content === '건조기 문이 안 닫혀요.');
    assert.equal(stored?.user_id, userB, '세션이 아니라 본문의 user_id 가 쓰이면 안 된다');
  });

  it('빈 문의는 400 이고 아무것도 남지 않는다', async () => {
    loginAs(userA);
    const before = (await inquiryRows(db)).length;

    const res = await submit({ content: '   ' });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);

    assert.equal((await inquiryRows(db)).length, before);
  });

  it('한도를 넘는 문의는 400 이고 아무것도 남지 않는다', async () => {
    loginAs(userA);
    const before = (await inquiryRows(db)).length;

    const res = await submit({ content: 'ㄱ'.repeat(MAX_INQUIRY_LENGTH + 1) });
    assert.equal(res.status, 400);

    assert.equal((await inquiryRows(db)).length, before);
  });

  it('로그인하지 않으면 401 이고 아무것도 남지 않는다', async () => {
    setTestSession(null);
    const before = (await inquiryRows(db)).length;

    const res = await submit({ content: '로그인 없이 보내 봅니다.' });
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);

    assert.equal((await inquiryRows(db)).length, before);
  });

  it('탈퇴 대기 계정은 403 이다 (05 P24)', async () => {
    setTestSession({ user: { id: userA }, withdrawPending: true });
    const before = (await inquiryRows(db)).length;

    const res = await submit({ content: '탈퇴 신청 뒤에 보내 봅니다.' });
    assert.equal(res.status, 403);

    assert.equal((await inquiryRows(db)).length, before);
  });
});

describe('관리자 문의 조회 (adminInquiries)', () => {
  let db: TestDb;
  let userA: string;
  let userB: string;

  before(async () => {
    db = await createTestDb();
    clearTestCookies();
    userA = await seedUser(db, 'admin-inquiry-a');
    userB = await seedUser(db, 'admin-inquiry-b');

    await db.query('INSERT INTO admin_accounts (login_id, password_hash) VALUES ($1, $2)', [
      ADMIN_LOGIN_ID,
      await hash(ADMIN_PASSWORD),
    ]);
  });

  after(async () => {
    clearTestCookies();
    await db.close();
  });

  it('관리자 쿠키가 없으면 조회할 수 없다', async () => {
    await assert.rejects(() => adminInquiries(), /NEXT_REDIRECT/);
  });

  it('문의가 없으면 빈 목록이다', async () => {
    assert.equal(await adminSignIn(ADMIN_LOGIN_ID, ADMIN_PASSWORD), true);
    assert.deepEqual(await adminInquiries(), []);
  });

  it('저장된 문의를 보낸 사람 정보와 함께 최신순으로 돌려준다', async () => {
    loginAs(userA);
    assert.equal((await submit({ content: '먼저 보낸 문의' })).status, 201);
    // created_at 이 같은 값이 되지 않게 한 칸 벌린다 (정렬을 확인해야 한다)
    await db.query("UPDATE inquiries SET created_at = created_at - interval '1 minute'");

    loginAs(userB);
    assert.equal((await submit({ content: '나중에 보낸 문의' })).status, 201);

    const rows = await adminInquiries();
    assert.equal(rows.length, 2);

    assert.equal(rows[0].content, '나중에 보낸 문의');
    assert.equal(rows[1].content, '먼저 보낸 문의');

    // users 조인 — 이름 · 학번 · 호실이 실제 사용자 값과 맞는다
    const [seededB] = (await db.query(
      'SELECT name, student_id, room FROM users WHERE user_id = $1',
      [userB],
    )) as { name: string; student_id: string; room: string }[];

    assert.equal(rows[0].user_id, userB);
    assert.equal(rows[0].user_name, seededB.name);
    assert.equal(rows[0].student_id, seededB.student_id);
    assert.equal(rows[0].room, seededB.room);
    assert.ok(rows[0].created_at, '작성 시각이 내려와야 한다');
  });

  it('계정이 지워지면 그 사람의 문의도 함께 사라진다 (05 P24)', async () => {
    await db.query('DELETE FROM users WHERE user_id = $1', [userA]);

    const rows = await adminInquiries();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, userB);
  });
});
