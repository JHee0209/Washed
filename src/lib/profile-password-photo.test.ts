// 비밀번호 변경 · 프로필 사진 삭제 회귀 테스트 (Issue #84).
//
// state-transition-e2e.test.ts 와 같은 하네스를 쓴다 — PGlite(인메모리 PostgreSQL) +
// @/auth 스텁(test/stubs/auth.mjs). Production · Preview DB 에는 어떤 읽기도
// 쓰기도 하지 않는다.
//
// 여기서 부르는 것은 전부 production 코드 그대로다: 서버 액션
// (verifyCurrentPassword · changePassword, src/lib/user-actions.ts)과 라우트
// 핸들러(GET · POST · DELETE, src/app/api/profile/photo/route.ts)를 직접 부른다.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { DELETE as deletePhoto, GET as getPhoto, POST as postPhoto } from '../app/api/profile/photo/route.ts';
import { hash, verify } from './hash.ts';
import { changePassword, verifyCurrentPassword } from './user-actions.ts';
import { createTestDb, seedUser } from '../../test/db-harness.mjs';
import { loginAs, setTestSession } from '../../test/stubs/auth.mjs';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function setPasswordHash(db: TestDb, userId: string, plain: string | null): Promise<void> {
  const hashed = plain === null ? null : await hash(plain);
  await db.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hashed, userId]);
}

async function passwordHashOf(db: TestDb, userId: string): Promise<string | null> {
  const rows = (await db.query('SELECT password_hash FROM users WHERE user_id = $1', [userId])) as {
    password_hash: string | null;
  }[];
  return rows[0]?.password_hash ?? null;
}

// detectImageMimeFromBytes 는 헤더 매직 넘버만 본다 — 완전한 이미지일 필요는 없다.
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

function photoFormData(bytes: Buffer, filename: string): FormData {
  const form = new FormData();
  form.append('photo', new File([new Uint8Array(bytes)], filename));
  return form;
}

async function uploadPhoto(bytes: Buffer, filename: string) {
  return postPhoto(
    new Request('http://test/api/profile/photo', { method: 'POST', body: photoFormData(bytes, filename) }),
  );
}

describe('비밀번호 변경 — 현재 비밀번호 검증 (Issue #84)', () => {
  let db: TestDb;
  let userId: string;

  before(async () => {
    db = await createTestDb();
    userId = await seedUser(db, 'pw-owner');
    await setPasswordHash(db, userId, 'correct-pass-1');
    loginAs(userId);
  });

  after(async () => {
    setTestSession(null);
    await db.close();
  });

  it('올바른 현재 비밀번호는 통과한다', async () => {
    const result = await verifyCurrentPassword('correct-pass-1');
    assert.equal(result.ok, true);
  });

  it('틀린 현재 비밀번호는 거부된다', async () => {
    const result = await verifyCurrentPassword('wrong-pass');
    assert.equal(result.ok, false);
  });

  it('현재 비밀번호가 맞고 새 비밀번호가 유효하면 실제로 저장된다', async () => {
    const result = await changePassword('correct-pass-1', 'new-pass-12345');
    assert.equal(result.ok, true);

    const newHash = await passwordHashOf(db, userId);
    assert.equal(await verify('new-pass-12345', newHash), true);
    assert.equal(await verify('correct-pass-1', newHash), false);
  });

  it('틀린 현재 비밀번호로는 변경되지 않는다 (해시 무변화)', async () => {
    const before = await passwordHashOf(db, userId);
    const result = await changePassword('wrong-pass', 'another-new-pass-1');
    assert.equal(result.ok, false);
    assert.equal(result.ok ? undefined : result.field, 'current');
    const afterHash = await passwordHashOf(db, userId);
    assert.equal(afterHash, before);
  });

  it('새 비밀번호가 8자 미만이면 거부된다', async () => {
    const result = await changePassword('new-pass-12345', 'short1');
    assert.equal(result.ok, false);
    assert.equal(result.ok ? undefined : result.field, 'new');
  });

  it('새 비밀번호가 현재 비밀번호와 같으면 거부된다', async () => {
    const result = await changePassword('new-pass-12345', 'new-pass-12345');
    assert.equal(result.ok, false);
    assert.equal(result.ok ? undefined : result.field, 'new');
  });

  it('비로그인 상태에서는 로그인을 요구한다', async () => {
    setTestSession(null);
    await assert.rejects(() => verifyCurrentPassword('anything'));
    await assert.rejects(() => changePassword('anything', 'new-pass-99999'));
    loginAs(userId);
  });
});

describe('비밀번호 변경 — 현재 로그인 사용자 기준(다른 사용자 영향 없음)', () => {
  let db: TestDb;
  let userA: string;
  let userB: string;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'pw-a');
    userB = await seedUser(db, 'pw-b');
    await setPasswordHash(db, userA, 'a-pass-1234');
    await setPasswordHash(db, userB, 'b-pass-1234');
  });

  after(async () => {
    setTestSession(null);
    await db.close();
  });

  it('A로 로그인해서 비밀번호를 바꿔도 B 의 해시는 그대로다', async () => {
    const bHashBefore = await passwordHashOf(db, userB);

    loginAs(userA);
    const result = await changePassword('a-pass-1234', 'a-new-pass-999');
    assert.equal(result.ok, true);

    const bHashAfter = await passwordHashOf(db, userB);
    assert.equal(bHashAfter, bHashBefore);
    // B 계정은 원래 자기 비밀번호로 여전히 검증된다 — A 의 변경에 영향받지 않았다.
    assert.equal(await verify('b-pass-1234', bHashAfter), true);
  });
});

describe('비밀번호 변경 — 구글 전용 계정(password_hash NULL)', () => {
  let db: TestDb;
  let userId: string;

  before(async () => {
    db = await createTestDb();
    // seedUser() 는 password_hash 를 채우지 않는다 — 이미 NULL(구글 전용 계정).
    userId = await seedUser(db, 'pw-google');
    loginAs(userId);
  });

  after(async () => {
    setTestSession(null);
    await db.close();
  });

  it('현재 비밀번호 확인 자체가 안전하게 거부된다(예외를 던지지 않음)', async () => {
    const result = await verifyCurrentPassword('anything');
    assert.equal(result.ok, false);
  });

  it('changePassword 도 새 비밀번호를 만들어 주지 않는다', async () => {
    const result = await changePassword('anything', 'new-pass-12345');
    assert.equal(result.ok, false);
    assert.equal(result.ok ? undefined : result.field, 'current');

    const hashAfter = await passwordHashOf(db, userId);
    assert.equal(hashAfter, null);
  });
});

describe('프로필 사진 삭제 (Issue #84)', () => {
  let db: TestDb;
  let userA: string;
  let userB: string;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'photo-a');
    userB = await seedUser(db, 'photo-b');
  });

  after(async () => {
    setTestSession(null);
    await db.close();
  });

  it('업로드 후 조회하면 저장한 그대로 돌아온다 (기존 업로드 기능 회귀 확인)', async () => {
    loginAs(userA);
    const uploadRes = await uploadPhoto(PNG_HEADER, 'photo.png');
    assert.equal(uploadRes.status, 200);

    const getRes = await getPhoto();
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get('content-type'), 'image/png');
  });

  it('삭제하면 404로 바뀐다 (ProfileAvatar 의 기본 이미지 fallback 대상)', async () => {
    const delRes = await deletePhoto();
    assert.equal(delRes.status, 200);

    const getRes = await getPhoto();
    assert.equal(getRes.status, 404);
  });

  it('사진이 없는 상태에서 다시 삭제해도 오류가 아니다 (idempotent)', async () => {
    const delRes = await deletePhoto();
    assert.equal(delRes.status, 200);
    const body = (await delRes.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  });

  it('A 의 사진 삭제는 B 의 사진에 영향을 주지 않는다', async () => {
    loginAs(userB);
    const uploadRes = await uploadPhoto(JPEG_HEADER, 'photo.jpg');
    assert.equal(uploadRes.status, 200);
    const bGetBefore = await getPhoto();
    assert.equal(bGetBefore.status, 200);

    loginAs(userA);
    await deletePhoto(); // A 는 이미 사진이 없으므로 idempotent 삭제일 뿐이다.

    loginAs(userB);
    const bGetAfter = await getPhoto();
    assert.equal(bGetAfter.status, 200);
  });

  it('비로그인 상태에서는 401을 돌려준다', async () => {
    setTestSession(null);
    const res = await deletePhoto();
    assert.equal(res.status, 401);
  });
});
