// DB 값 → 번역 key 매핑이 스키마 · report-rules 와 어긋나지 않는지
// (Issue #13 의 13번 「동적 데이터와 고정 UI 구분」).
//
// 여기가 깨지면 화면에 라벨이 아니라 key 가 찍히거나, 더 나쁘게는 번역된 문자열이
// DB 로 흘러가 CHECK 제약에 걸린다.
//
// 실행: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MACHINE_KINDS, REASON_LABELS } from '../report-rules.ts';
import {
  HISTORY_RESULT_KEY,
  MACHINE_KIND_KEY,
  MACHINE_STATUS_KEY,
  NOTIFICATION_KIND_KEY,
  REPORT_REASON_LABEL_KEY,
  WARNING_REASON_KEY,
  machineStatusKey,
  notificationKindKey,
  warningReasonKey,
} from './db-labels.ts';
import { ko } from './ko.ts';

const ALL_MAPS = {
  MACHINE_KIND_KEY,
  MACHINE_STATUS_KEY,
  NOTIFICATION_KIND_KEY,
  HISTORY_RESULT_KEY,
  WARNING_REASON_KEY,
  REPORT_REASON_LABEL_KEY,
} as const;

describe('매핑이 가리키는 key 가 사전에 실제로 있다', () => {
  for (const [name, map] of Object.entries(ALL_MAPS)) {
    it(`${name}`, () => {
      for (const [dbValue, key] of Object.entries(map)) {
        assert.ok(
          Object.hasOwn(ko, key),
          `${name}['${dbValue}'] 가 가리키는 ${key} 가 ko 사전에 없습니다.`,
        );
      }
    });
  }
});

describe('매핑의 key 집합이 원본 상수와 같다', () => {
  it('기기 종류는 report-rules.ts 의 MACHINE_KINDS 와 같다', () => {
    assert.deepEqual(Object.keys(MACHINE_KIND_KEY).sort(), [...MACHINE_KINDS].sort());
  });

  it('신고 사유는 report-rules.ts 의 REASON_LABELS 와 같다', () => {
    assert.deepEqual(Object.keys(REPORT_REASON_LABEL_KEY).sort(), [...REASON_LABELS].sort());
  });

  it('기기 상태는 db/schema.sql machines.status CHECK 와 같다', () => {
    assert.deepEqual(Object.keys(MACHINE_STATUS_KEY).sort(), ['고장', '사용가능', '사용중', '점검중']);
  });

  it('알림 종류는 db/schema.sql notifications.kind CHECK 와 같다', () => {
    assert.deepEqual(Object.keys(NOTIFICATION_KIND_KEY).sort(), ['결과', '경고', '공지', '배정', '종료']);
  });

  it('경고 사유는 db/schema.sql warnings.reason CHECK 와 같다', () => {
    assert.deepEqual(
      Object.keys(WARNING_REASON_KEY).sort(),
      ['배정 후 미인증', '세탁물 방치', '수거 미완료', '순서 미준수', '신고 확인'].sort(),
    );
  });

  it('이용 내역 결과는 db/schema.sql usage_history.result CHECK 와 같다', () => {
    assert.deepEqual(Object.keys(HISTORY_RESULT_KEY).sort(), ['경고', '완료']);
  });
});

describe('저장값과 화면 문구가 다른 자리', () => {
  it("기기 상태 저장값은 '점검중'(붙여씀)이고 화면 문구는 「점검 중」(띄어씀)이다", () => {
    // 화면 문자열로 DB 를 조회하면 한 건도 걸리지 않는 자리라 따로 못 박는다.
    assert.equal(machineStatusKey('점검중'), 'enum.machineStatus.inspection');
    assert.equal(ko['enum.machineStatus.inspection'], '점검 중');
    assert.equal(machineStatusKey('점검 중'), null);
  });

  it("알림 종류 '결과' 는 화면에 「신고」로 나간다", () => {
    assert.equal(notificationKindKey('결과'), 'enum.notificationKind.report');
    assert.equal(ko['enum.notificationKind.report'], '신고');
  });
});

describe('모르는 값이 와도 깨지지 않는다', () => {
  it('CHECK 에 없는 옛 값은 null 을 돌려준다 (화면은 저장된 원문을 그대로 쓴다)', () => {
    assert.equal(warningReasonKey('옛날에 쓰던 사유'), null);
    assert.equal(machineStatusKey(''), null);
  });

  it('프로토타입 오염으로 엉뚱한 key 가 나오지 않는다', () => {
    assert.equal(warningReasonKey('toString'), null);
    assert.equal(notificationKindKey('constructor'), null);
  });
});
