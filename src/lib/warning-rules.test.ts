// 관리자 경고 사유 · 사건 참조 규칙 (05 P6 · P6-1 · P16 · Issue #8 · #47).
//
// 실행: npm test
//
// warning-rules.ts 는 `server-only` 도 `@/lib/db` 도 쓰지 않는 공용 모듈이라(화면과
// 서버가 같은 집합을 보게 하는 것이 그 파일의 존재 이유다) **실제로 import 해서**
// 확인할 수 있다 — 이 저장소의 다른 테스트처럼 DB 없이 돈다.
//
// 여기서 지키는 것은 중복 방지의 **판정 근거**다. DB 의 부분 UNIQUE 인덱스가 최종
// 차단을 하지만(그건 DB 가 있어야 확인할 수 있어 수동 테스트로 검증한다), 어떤
// 사유에 사건이 필요한지 · 클라이언트가 보낸 사건 참조를 믿어도 되는지는 여기서 갈린다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ADMIN_WARNING_REASONS,
  decodeWarningIncident,
  encodeWarningIncident,
  isAdminWarningReasonValue,
  isWarningIncidentRef,
  requiresWarningIncident,
  SYSTEM_WARNING_REASONS,
  warningReasonLabel,
} from './warning-rules.ts';

describe('05 P6 — 자동 경고와 겹치는 사유는 사건을 요구한다', () => {
  it('시스템 자동 사유 두 가지는 사건이 필수다', () => {
    // 스케줄러가 같은 사유로 같은 사건에 자동 경고를 매긴다 — 사건 없이 받으면
    // 서버가 두 경고를 비교할 근거가 없어 중복을 막을 수 없다.
    assert.equal(requiresWarningIncident('배정 후 미인증'), true);
    assert.equal(requiresWarningIncident('수거 미완료'), true);
  });

  it('관리자 전용 사유는 사건 없이도 줄 수 있다', () => {
    // 자동 판정이 없는 사유라 겹칠 상대가 없다 — F29 의 일반 경고가 그대로 살아야 한다.
    assert.equal(requiresWarningIncident('신고 확인'), false);
    assert.equal(requiresWarningIncident('순서 미준수'), false);
    assert.equal(requiresWarningIncident('세탁물 방치'), false);
  });

  it('관리자가 화면에서 고르는 사유는 모두 사건이 필수가 아니다', () => {
    // 이 둘 중 하나라도 필수가 되면 기존 F29 경고 버튼이 사건 없이는 안 눌린다.
    for (const { value } of ADMIN_WARNING_REASONS) {
      assert.equal(requiresWarningIncident(value), false, `${value} 가 사건 필수가 됐습니다.`);
    }
  });

  it('앞뒤 공백이 있어도 같게 판정한다 — issueWarning 이 trim 전에 검사한다', () => {
    assert.equal(requiresWarningIncident('  수거 미완료  '), true);
  });

  it('자동 사유 집합과 관리자 사유 집합은 겹치지 않는다 (05 P6-1)', () => {
    const adminValues = ADMIN_WARNING_REASONS.map((r) => r.value) as readonly string[];
    for (const reason of SYSTEM_WARNING_REASONS) {
      assert.equal(adminValues.includes(reason), false, `${reason} 가 양쪽에 있습니다.`);
    }
  });
});

describe('사건 참조 — 클라이언트 입력을 그대로 믿지 않는다', () => {
  it('올바른 모양만 통과한다', () => {
    assert.equal(isWarningIncidentRef({ kind: 'queue', id: 'abc' }), true);
    assert.equal(isWarningIncidentRef({ kind: 'usage', id: 'abc' }), true);
  });

  it('모르는 kind 는 거절한다 — queue 로 넘겨짚지 않는다', () => {
    // 넘겨짚으면 엉뚱한 표의 uuid 가 사건 키로 들어가 중복 검사가 조용히 빗나간다.
    assert.equal(isWarningIncidentRef({ kind: 'report', id: 'abc' }), false);
    assert.equal(isWarningIncidentRef({ kind: '', id: 'abc' }), false);
    assert.equal(isWarningIncidentRef({ id: 'abc' }), false);
  });

  it('id 가 없거나 빈 문자열이면 거절한다', () => {
    assert.equal(isWarningIncidentRef({ kind: 'queue', id: '' }), false);
    assert.equal(isWarningIncidentRef({ kind: 'queue' }), false);
    assert.equal(isWarningIncidentRef({ kind: 'queue', id: 123 }), false);
  });

  it('객체가 아닌 값도 거절한다', () => {
    assert.equal(isWarningIncidentRef(null), false);
    assert.equal(isWarningIncidentRef(undefined), false);
    assert.equal(isWarningIncidentRef('queue:abc'), false);
  });
});

describe('사건 참조 표기 — 화면과 서버가 같은 문자열을 본다', () => {
  it('적었다 되읽으면 그대로다', () => {
    for (const kind of ['queue', 'usage'] as const) {
      const ref = { kind, id: '11111111-2222-3333-4444-555555555555' };
      assert.deepEqual(decodeWarningIncident(encodeWarningIncident(ref)), ref);
    }
  });

  it('고르지 않았으면 빈 문자열이고, 되읽으면 null 이다', () => {
    // null 은 "사건 없는 경고" 를 뜻한다 — issueWarning 이 그때 예전 동작을 한다.
    assert.equal(encodeWarningIncident(null), '');
    assert.equal(decodeWarningIncident(''), null);
  });

  it('모양이 아니면 null 이다', () => {
    assert.equal(decodeWarningIncident('abc'), null);
    assert.equal(decodeWarningIncident(':abc'), null);
    assert.equal(decodeWarningIncident('queue:'), null);
    assert.equal(decodeWarningIncident('report:abc'), null);
  });

  it('id 에 콜론이 있어도 첫 콜론에서만 가른다', () => {
    assert.deepEqual(decodeWarningIncident('usage:a:b'), { kind: 'usage', id: 'a:b' });
  });
});

describe('사유 라벨 (Issue #47 · #54)', () => {
  it('관리자 사유는 읽기 쉬운 문장으로 바꾼다', () => {
    assert.equal(warningReasonLabel('순서 미준수'), '순서를 지키지 않았어요');
    assert.equal(warningReasonLabel('세탁물 방치'), '세탁물이 있어요');
  });

  it('매핑이 없는 사유는 DB 값을 그대로 보여준다', () => {
    assert.equal(warningReasonLabel('배정 후 미인증'), '배정 후 미인증');
    assert.equal(warningReasonLabel('신고 확인'), '신고 확인');
  });

  it('화면 라벨은 DB 저장값이 아니다 — 그대로 INSERT 하면 CHECK 에 걸린다', () => {
    assert.equal(isAdminWarningReasonValue('순서를 지키지 않았어요'), false);
    assert.equal(isAdminWarningReasonValue('순서 미준수'), true);
  });
});
