// 관리자 콘솔의 탭 내용 — 표 일곱 개.
//
// 표 값(색 · 크기 · nowrap)은 docs/design/관리자.dc.html 그대로다.
// 바꾸는 단추는 전부 서버 액션을 부르고, 액션은 requireAdmin() 을 먼저 지난다.

'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import {
  addMachine,
  addNotice,
  adminUserIncidents,
  cancelQueue,
  clearRestriction,
  issueWarning,
  removeMachine,
  removeNotice,
  revokeWarning,
  setFacilityInspection,
  setMachineStatus,
  setReportStatus,
} from '@/lib/admin-actions';
import {
  ADMIN_WARNING_REASONS,
  decodeWarningIncident,
  encodeWarningIncident,
  requiresWarningIncident,
  warningReasonLabel,
  type WarningIncidentOption,
} from '@/lib/warning-rules';

type Data = {
  machines: {
    machine_id: string;
    name: string;
    kind: string;
    status: string;
    minutes_left: number | null;
    // Issue #54 — 배정('배정')과 실사용('사용중')을 구분하려고 함께 내려온다.
    queue_status: string | null;
    current_user_name: string | null;
    current_user_room: string | null;
  }[];
  // 06 「세탁실」 · F33 · Issue #47 — dashboard 탭에서만 채운다.
  facilityStatus: { isUnderInspection: boolean } | null;
  queue: {
    rows: {
      queue_id: string;
      user_name: string;
      room: string;
      machine_kind: string;
      machine_name: string | null;
      status: string;
      waited_minutes: number;
    }[];
    // 홈 화면(F1)과 같은 규칙(05 P2 · queries.ts::queueCounts())으로 센 값이다.
    counts: { 세탁기: number; 건조기: number };
  };
  reports: {
    report_id: string;
    user_name: string;
    room: string;
    reason: string;
    machine_kind: string | null;
    machine_no: number | null;
    // 05 P15 — 「세탁물 있음」에만 값이 있다. 3개월이 지나 사진이 지워져도
    // 이 주소는 남고 열면 410 이 온다 (0005 · 05 P23).
    evidence_photo_url: string | null;
    etc_content: string | null;
    status: string;
    created_at: string;
  }[];
  history: {
    history_id: string;
    user_id: string;
    user_name: string;
    room: string;
    machine_name: string | null;
    started_at: string;
    result: string;
    used_minutes: number | null;
  }[];
  warnings: {
    user_id: string;
    user_name: string;
    room: string;
    student_id: string;
    warning_count: number;
    restricted_until: string | null;
    is_restricted: boolean;
    days_left: number | null;
    // Issue #54 — 최근 1개월 안의 warnings 행 전체(최신순). recent_month_count 와
    // 길이가 같지만, 「제재 횟수와는 다른 값」이라는 기존 의미 때문에 필드는 따로 둔다.
    history: { reason: string; issued_at: string; issued_by: string }[];
    recent_month_count: number;
  }[];
  notices: { notice_id: string; title: string; body: string; created_at: string }[];
  users: {
    user_id: string;
    name: string;
    email: string;
    gender: string;
    school: string;
    student_id: string;
    room: string;
    signup_method: string;
    created_at: string;
    withdraw_requested_at: string | null;
    warning_count: number;
    restricted_until: string | null;
    is_restricted: boolean;
    days_left: number | null;
  }[];
};

export default function AdminTabs({ tab, data }: { tab: string; data: Data }) {
  if (tab === 'dashboard') {
    return <Machines rows={data.machines} facilityStatus={data.facilityStatus} />;
  }
  if (tab === 'queue') return <Queue rows={data.queue.rows} counts={data.queue.counts} />;
  if (tab === 'reports') return <Reports rows={data.reports} />;
  if (tab === 'history') return <History rows={data.history} />;
  if (tab === 'warnings') return <Warnings rows={data.warnings} />;
  if (tab === 'notice') return <Notices rows={data.notices} />;
  return <Users rows={data.users} />;
}

// ─── 공통 표 조각 ────────────────────────────────────────────────────────────

const cell: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #F1F5FC',
};
const head: React.CSSProperties = {
  ...cell,
  fontSize: 12,
  fontWeight: 700,
  color: '#5A7CA8',
  background: '#F8FAFE',
  textAlign: 'left',
};

function Table({ cols, children }: { cols: string[]; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(47,99,184,.06)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={head}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ span, text }: { span: number; text: string }) {
  return (
    <tr>
      <td colSpan={span} style={{ ...cell, textAlign: 'center', color: '#A8BCD9', padding: 36 }}>
        {text}
      </td>
    </tr>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

function Btn({
  children,
  onClick,
  tone = 'plain',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'plain' | 'danger' | 'primary';
  /** 바깥 조건으로 잠글 때 (05 P6 — 사건 목록을 못 받았으면 경고를 줄 수 없다) */
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const off = pending || disabled;
  const p = {
    plain: { bg: '#fff', fg: '#5A6E8F', bd: '#E3EBF7' },
    danger: { bg: '#fff', fg: '#C2453E', bd: '#F3C9C6' },
    primary: { bg: '#4C86D8', fg: '#fff', bd: '#4C86D8' },
  }[tone];

  return (
    <button
      onClick={() => start(onClick)}
      disabled={off}
      style={{
        padding: '6px 11px',
        borderRadius: 9,
        border: `1px solid ${p.bd}`,
        background: p.bg,
        color: p.fg,
        cursor: off ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        opacity: off ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function fmt(iso: string, withTime = true) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

// ─── 탭 1 · 실시간 기기 현황 (F23 · F24) ─────────────────────────────────────

function Machines({
  rows,
  facilityStatus,
}: {
  rows: Data['machines'];
  facilityStatus: Data['facilityStatus'];
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('세탁기');
  const [pending, start] = useTransition();

  const color = (s: string) =>
    s === '사용가능'
      ? '#00BF40'
      : s === '사용중'
        ? '#2F63B8'
        : s === '고장'
          ? '#E52222'
          : s === '배정'
            ? '#8FAAD0'
            : s === '수거대기'
              ? '#C2453E'
              : '#FF9200';

  const underInspection = facilityStatus?.isUnderInspection ?? false;

  return (
    <>
      {/* 05 P20 · 06 「세탁실」 · F33 · Issue #47 — 기기 단위 점검(machines.status
          의 '점검중')과 완전히 별개다. 개별 점검 조작 버튼은 이 화면에 두지 않고
          세탁실 전체를 한 번에 잠그는 토글 하나만 둔다. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Dot color={underInspection ? '#FF9200' : '#00BF40'} />
        <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          세탁실 {underInspection ? '점검 중' : '운영 중'}
        </span>
        <Btn
          tone={underInspection ? 'primary' : 'danger'}
          onClick={() => setFacilityInspection(!underInspection)}
        >
          {underInspection ? '점검 해제' : '세탁실 점검 시작'}
        </Btn>
      </div>
      {underInspection ? (
        <div
          style={{
            padding: '11px 14px',
            marginBottom: 16,
            borderRadius: 12,
            background: 'rgba(255,146,0,.1)',
            fontSize: 12.5,
            color: '#8A5300',
            lineHeight: 1.7,
          }}
        >
          세탁실 전체가 점검 중이에요 — 모든 세탁기 · 건조기의 신규 줄서기와 배정이
          멈춰 있어요. 이미 배정 · 사용 중인 건은 그대로 진행됩니다.
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="기기 이름 (예: 세탁기 1호기)"
          style={{
            flex: '1 1 220px',
            height: 40,
            padding: '0 13px',
            borderRadius: 10,
            border: '1px solid #E3EBF7',
            fontSize: 13,
          }}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          style={{
            height: 40,
            padding: '0 11px',
            borderRadius: 10,
            border: '1px solid #E3EBF7',
            fontSize: 13,
          }}
        >
          <option>세탁기</option>
          <option>건조기</option>
        </select>
        <button
          onClick={() =>
            start(async () => {
              await addMachine(name, kind);
              setName('');
            })
          }
          disabled={pending || !name.trim()}
          style={{
            height: 40,
            padding: '0 16px',
            borderRadius: 10,
            border: 0,
            background: '#4C86D8',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            opacity: pending || !name.trim() ? 0.5 : 1,
          }}
        >
          기기 추가
        </button>
      </div>

      <Table cols={['기기', '종류', '상태', '남은 시간', '현재 사용자', '']}>
        {rows.length === 0 ? (
          <EmptyRow span={6} text="등록된 기기가 없어요. 위에서 추가해주세요." />
        ) : (
          rows.map((m) => {
            // 05 P20 · 06 「세탁실」 · Issue #47 — 세탁실 전체 점검 중에는 화면
            // 표시만 모든 기기를 "점검중"으로 보여준다. machines.status(실제 값)는
            // 건드리지 않으므로 점검 해제 즉시 각 기기의 실제 상태로 돌아온다.
            //
            // Issue #54 — 점검 표시 다음 우선순위로, 활성 queue(배정 · 사용중 ·
            // 수거대기)가 있으면 그 단계를 그대로 보여준다. machines.status 는
            // 배정 시점에 이미 '사용중'(중복 배정 방지 락)이 되고, 수거대기 동안도
            // 기기 상태값 자체는 '수거대기'가 없어 '사용중'으로 남는다
            // (expiration.ts::transitionUsageToPickup 주석 — "기기는 그대로
            // 사용중으로 둔다"). 그 값을 그대로 보여주면 QR 미인증 · 수거 대기
            // 중인 사람이 실제 사용중처럼 보인다. 활성 queue 가 없을 때만
            // machines.status(사용가능 · 고장 · 점검중)로 돌아간다.
            const displayStatus = underInspection
              ? '점검중'
              : (m.queue_status ?? m.status);
            return (
              <tr key={m.machine_id}>
                <td style={{ ...cell, fontWeight: 700 }}>{m.name}</td>
                <td style={cell}>{m.kind}</td>
                <td style={cell}>
                  <Dot color={color(displayStatus)} />
                  {displayStatus}
                </td>
                <td style={{ ...cell, color: '#8FAAD0' }}>
                  {m.minutes_left !== null ? `약 ${m.minutes_left}분` : '—'}
                </td>
                <td style={cell}>
                  {m.current_user_name
                    ? `${m.current_user_name} (${m.current_user_room})`
                    : '사용자 없음'}
                </td>
                <td style={cell}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {m.status === '고장' ? (
                      <Btn onClick={() => setMachineStatus(m.machine_id, '사용가능')}>복구</Btn>
                    ) : (
                      <Btn tone="danger" onClick={() => setMachineStatus(m.machine_id, '고장')}>
                        고장
                      </Btn>
                    )}
                    <Btn tone="danger" onClick={() => removeMachine(m.machine_id)}>
                      삭제
                    </Btn>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </Table>
    </>
  );
}

// ─── 탭 2 · 실시간 대기열 (F23) ──────────────────────────────────────────────

function Queue({
  rows,
  counts,
}: {
  rows: Data['queue']['rows'];
  counts: Data['queue']['counts'];
}) {
  return (
    <>
      {/*
        05 P2 · 08 3번 — 대기 인원은 그 종류에 바로 쓸 수 있는 기기가 있으면 0명이다.
        이 숫자는 홈 화면(F1)과 같은 함수(queueCounts())가 낸 값이라 항상 일치한다.
      */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '11px 14px',
          marginBottom: 14,
          borderRadius: 12,
          background: 'rgba(47,99,184,.06)',
          fontSize: 12.5,
          color: '#33456B',
          fontWeight: 600,
        }}
      >
        <span>세탁기 대기 {counts.세탁기}명</span>
        <span>건조기 대기 {counts.건조기}명</span>
      </div>

      <Table cols={['사용자', '호실', '종류', '배정 기기', '상태', '대기', '']}>
        {rows.length === 0 ? (
          <EmptyRow span={7} text="지금 줄 선 사람이 없어요." />
        ) : (
          rows.map((q) => (
            <tr key={q.queue_id}>
              <td style={{ ...cell, fontWeight: 700 }}>{q.user_name}</td>
              <td style={cell}>{q.room}</td>
              <td style={cell}>{q.machine_kind}</td>
              <td style={{ ...cell, color: '#8FAAD0' }}>{q.machine_name ?? '—'}</td>
              <td style={cell}>
                <Dot color={q.status === '배정' ? '#FF9200' : '#2F63B8'} />
                {q.status}
              </td>
              <td style={{ ...cell, color: '#8FAAD0' }}>{q.waited_minutes}분</td>
              <td style={cell}>
                <Btn tone="danger" onClick={() => cancelQueue(q.queue_id)}>
                  취소
                </Btn>
              </td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}

// ─── 탭 3 · 신고 내역 (F27) ──────────────────────────────────────────────────

function Reports({ rows }: { rows: Data['reports'] }) {
  return (
    <Table cols={['접수', '신고자', '호실', '사유', '대상', '증거', '상태', '']}>
      {rows.length === 0 ? (
        <EmptyRow span={8} text="접수된 신고가 없어요." />
      ) : (
        rows.map((r) => (
          <tr key={r.report_id}>
            <td style={{ ...cell, color: '#8FAAD0' }}>{fmt(r.created_at)}</td>
            <td style={{ ...cell, fontWeight: 700 }}>{r.user_name}</td>
            <td style={cell}>{r.room}</td>
            <td style={cell} title={r.etc_content ?? undefined}>
              {r.reason}
            </td>
            <td style={{ ...cell, color: '#8FAAD0' }}>
              {r.machine_kind ? `${r.machine_kind} ${r.machine_no ?? ''}` : '—'}
            </td>
            {/*
              05 P15 — 증거 사진은 「세탁물 있음」에만 있다. 관리자가 처리완료(사실)와
              반려(거짓)를 가르는 근거라(P9) 여기서 열어 볼 수 있어야 한다.
              주소는 권한을 보고 내려주는 라우트다 — 관리자 세션으로 통과한다.
              05 P23 의 3개월이 지나 사진이 지워지면 그 주소가 410 을 돌려준다.
            */}
            <td style={cell}>
              {r.evidence_photo_url ? (
                <a
                  href={r.evidence_photo_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2F63B8', fontWeight: 600 }}
                >
                  사진
                </a>
              ) : (
                <span style={{ color: '#8FAAD0' }}>—</span>
              )}
            </td>
            <td style={cell}>
              <Dot
                color={
                  r.status === '처리완료'
                    ? '#00BF40'
                    : r.status === '반려'
                      ? '#E52222'
                      : r.status === '처리중'
                        ? '#2F63B8'
                        : '#FF9200'
                }
              />
              {r.status}
            </td>
            {/*
              05 P9 — 접수됨 → 처리중 → 처리완료 순으로 가고, 반려는 접수됨 · 처리중
              어디서든 고를 수 있다. 처리완료 · 반려는 되돌릴 수 없으므로 그 자리에서는
              단추를 아예 내지 않는다("배지가 눌리지 않는다").
              서버(setReportStatus)도 같은 표로 한 번 더 막는다.
            */}
            <td style={cell}>
              <div style={{ display: 'flex', gap: 6 }}>
                {r.status === '접수됨' ? (
                  <Btn onClick={() => setReportStatus(r.report_id, '처리중')}>처리중</Btn>
                ) : null}
                {r.status === '처리중' ? (
                  <Btn tone="primary" onClick={() => setReportStatus(r.report_id, '처리완료')}>
                    완료
                  </Btn>
                ) : null}
                {r.status === '접수됨' || r.status === '처리중' ? (
                  <Btn onClick={() => setReportStatus(r.report_id, '반려')}>반려</Btn>
                ) : null}
              </div>
            </td>
          </tr>
        ))
      )}
    </Table>
  );
}

// ─── 탭 4 · 이용 내역 (F28) ──────────────────────────────────────────────────

function History({ rows }: { rows: Data['history'] }) {
  return (
    <Table cols={['시작', '사용자', '호실', '기기', '결과', '사용 시간']}>
      {rows.length === 0 ? (
        <EmptyRow span={6} text="최근 3개월 이용 내역이 없어요." />
      ) : (
        rows.map((h) => (
          <tr key={h.history_id}>
            <td style={{ ...cell, color: '#8FAAD0' }}>{fmt(h.started_at)}</td>
            <td style={{ ...cell, fontWeight: 700 }}>{h.user_name}</td>
            <td style={cell}>{h.room}</td>
            <td style={cell}>{h.machine_name ?? '—'}</td>
            <td style={cell}>
              <Dot color={h.result === '정상 이용' ? '#00BF40' : '#FF9200'} />
              {h.result}
            </td>
            {/* 「배정 후 미이용」에는 사용 시간이 없다 (2026-09-15 갱신) */}
            <td style={{ ...cell, color: '#8FAAD0' }}>
              {h.used_minutes !== null ? `${h.used_minutes}분` : '—'}
            </td>
          </tr>
        ))
      )}
    </Table>
  );
}

// ─── 탭 5 · 경고 누적 사용자 (F25) ───────────────────────────────────────────

function Warnings({ rows }: { rows: Data['warnings'] }) {
  return (
    <>
      <div
        style={{
          padding: '11px 14px',
          marginBottom: 14,
          borderRadius: 12,
          background: 'rgba(47,99,184,.06)',
          fontSize: 12.5,
          color: '#33456B',
          lineHeight: 1.7,
        }}
      >
        경고 <strong>3회</strong>가 쌓이면 <strong>3일</strong> 동안 줄서기가 자동으로 제한됩니다.
        제한이 끝나면 경고는 0회로 초기화되고, 매달 1일에도 초기화됩니다. (05 P7)
        <br />
        경고 기록은 <strong>최근 1개월</strong>만 보관·조회할 수 있어요 — 「현재 경고」(제재 횟수)와
        「최근 1개월 경고 이력」(기록 건수)은 서로 다른 값일 수 있습니다. (05 SP4)
      </div>

      <Table cols={['사용자', '학번', '호실', '경고', '경고 이력', '제한', '']}>
        {rows.length === 0 ? (
          <EmptyRow span={7} text="경고를 받은 사용자가 없어요." />
        ) : (
          rows.map((w) => (
            <tr key={w.user_id} id={`user-${w.user_id}`}>
              <td style={{ ...cell, fontWeight: 700 }}>
                {/* Issue #28 — 사용자 목록 탭의 같은 사용자 행으로 이동 */}
                <Link href={`/admin?tab=users#user-${w.user_id}`} style={{ color: 'inherit' }}>
                  {w.user_name}
                </Link>
              </td>
              <td style={cell}>{w.student_id}</td>
              <td style={cell}>{w.room}</td>
              <td style={cell}>
                <Gauge count={w.warning_count} />
                {/* 05 SP4 — 현재 경고(제재 횟수)와 최근 1개월 경고 이력(기록 건수)은 다른 값이라 나눠 보여준다 */}
                <div style={{ fontSize: 11, color: '#8FAAD0', marginTop: 4, whiteSpace: 'nowrap' }}>
                  최근 1개월 경고 이력 {w.recent_month_count}건
                </div>
              </td>
              {/*
                Issue #54 — 가장 최근 사유 1건이 아니라 최근 1개월 안의 warnings 행
                전체를 최신순으로 보여준다. 화면 라벨은 warning-rules.ts 의 매핑을
                그대로 쓴다(자동 사유 · 예전 '신고 확인'은 매핑이 없어 DB 값 그대로).
              */}
              <td style={{ ...cell, whiteSpace: 'normal', color: '#5A6E8F' }}>
                {w.history.length === 0 ? (
                  <span style={{ color: '#A8BCD9' }}>—</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {w.history.map((h, i) => (
                      <span key={i} style={{ fontSize: 12 }}>
                        {warningReasonLabel(h.reason)} · {h.issued_by} · {fmt(h.issued_at)}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td style={cell}>
                <RestrictionBadge isRestricted={w.is_restricted} daysLeft={w.days_left} />
              </td>
              <td style={cell}>
                {/* Issue #54 — "경고 +1"·"경고 −1"은 제거했다(「사용자 목록」 탭의
                    사유 선택 경고 부여로 통일). 「제한 해제」만 유지한다. */}
                {w.is_restricted ? (
                  <Btn tone="primary" onClick={() => clearRestriction(w.user_id)}>
                    제한 해제
                  </Btn>
                ) : null}
              </td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}

/** 05 P7 — 제한 상태 배지. 경고 탭·사용자 목록 탭 둘 다에서 쓴다(Issue #28). */
function RestrictionBadge({
  isRestricted,
  daysLeft,
}: {
  isRestricted: boolean;
  daysLeft: number | null;
}) {
  if (!isRestricted) return <span style={{ color: '#A8BCD9' }}>—</span>;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        borderRadius: 8,
        background: 'rgba(229,34,34,.1)',
        color: '#C2453E',
        fontSize: 11.5,
        fontWeight: 700,
      }}
    >
      이용정지 · {daysLeft}일 남음
    </span>
  );
}

/** 05 P7 — 3칸 게이지. 1회 파랑 · 2회 주황 · 3회 빨강 */
function Gauge({ count }: { count: number }) {
  const color = count >= 3 ? '#E52222' : count === 2 ? '#FF9200' : '#2F63B8';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 16,
              height: 6,
              borderRadius: 3,
              background: i < count ? color : '#EAF0FA',
            }}
          />
        ))}
      </span>
      <span style={{ fontWeight: 700, color, whiteSpace: 'nowrap' }}>{count} / 3</span>
    </span>
  );
}

// ─── 탭 6 · 공지사항 (F26) ───────────────────────────────────────────────────

function Notices({ rows }: { rows: Data['notices'] }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();

  return (
    <>
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
          boxShadow: '0 2px 10px rgba(47,99,184,.06)',
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="공지 제목"
          style={{
            width: '100%',
            height: 40,
            padding: '0 13px',
            borderRadius: 10,
            border: '1px solid #E3EBF7',
            fontSize: 13,
            marginBottom: 8,
          }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="내용"
          rows={3}
          style={{
            width: '100%',
            padding: 13,
            borderRadius: 10,
            border: '1px solid #E3EBF7',
            fontSize: 13,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11.5, color: '#A8BCD9' }}>등록 후 3개월 뒤 자동으로 지워집니다 (P18)</span>
          <button
            onClick={() =>
              start(async () => {
                await addNotice(title, body);
                setTitle('');
                setBody('');
              })
            }
            disabled={pending || !title.trim() || !body.trim()}
            style={{
              height: 38,
              padding: '0 16px',
              borderRadius: 10,
              border: 0,
              background: '#4C86D8',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              opacity: pending || !title.trim() || !body.trim() ? 0.5 : 1,
            }}
          >
            공지 올리기
          </button>
        </div>
      </div>

      <Table cols={['등록', '제목', '내용', '']}>
        {rows.length === 0 ? (
          <EmptyRow span={4} text="등록된 공지가 없어요." />
        ) : (
          rows.map((n) => (
            <tr key={n.notice_id}>
              <td style={{ ...cell, color: '#8FAAD0' }}>{fmt(n.created_at, false)}</td>
              <td style={{ ...cell, fontWeight: 700 }}>{n.title}</td>
              <td style={{ ...cell, whiteSpace: 'normal', color: '#5A6E8F', maxWidth: 380 }}>
                {n.body}
              </td>
              <td style={cell}>
                <Btn tone="danger" onClick={() => removeNotice(n.notice_id)}>
                  삭제
                </Btn>
              </td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}

// ─── 탭 7 · 사용자 목록 (F29) ────────────────────────────────────────────────

function Users({ rows }: { rows: Data['users'] }) {
  const [target, setTarget] = useState<string | null>(null);

  // 05 P6 · Issue #8 — 어느 사건에 대한 경고인지 관리자가 고른다. 서버는 이 값으로
  // canonical 사건 키(warnings.incident_queue_id · 0012 · 0013)를 정해 자동 경고와의
  // 중복을 막는다. 사유만으로는 다른 날 · 다른 이용 건의 같은 사유와 구분할 수 없어
  // 막을 수도 허용할 수도 없다.
  //
  // 'loading' · 'failed' 를 빈 배열과 **구분**하는 것이 중요하다 — 빈 배열은 "사건이
  // 없다"는 서버의 답이라 사건 없는 일반 경고가 정당하지만, 실패는 답이 아니라서
  // 그대로 통과시키면 중복 방지가 통째로 비켜간다. 그래서 실패면 버튼을 잠근다.
  const [incidents, setIncidents] = useState<'loading' | 'failed' | WarningIncidentOption[]>(
    'loading',
  );
  const [picked, setPicked] = useState('');
  const [notice, setNotice] = useState('');

  /** 경고 패널을 연다 — 그 사용자의 사건 목록을 서버에서 받아온다 */
  async function openFor(userId: string) {
    setTarget(userId);
    setPicked('');
    setNotice('');
    setIncidents('loading');
    try {
      setIncidents(await adminUserIncidents(userId));
    } catch {
      setIncidents('failed');
    }
  }

  const incidentsPending = incidents === 'loading' || incidents === 'failed';

  return (
    <>
      {target ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            boxShadow: '0 2px 10px rgba(47,99,184,.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {rows.find((u) => u.user_id === target)?.name} 에게 줄 경고 유형을 선택하세요
          </span>

          {/*
            05 P6 · Issue #8 — 어느 사건에 대한 경고인지 고른다. 이미 경고가 있는 사건은
            고를 수 없고(최종 판정은 DB 의 부분 UNIQUE 가 한다), 목록을 받지 못했으면
            아래 버튼이 잠긴다 — 사건을 모르는 채로 주면 중복 방지가 비켜가기 때문이다.
          */}
          {incidents === 'loading' ? (
            <span style={{ fontSize: 12, color: '#8FAAD0' }}>사건 목록을 불러오는 중이에요…</span>
          ) : incidents === 'failed' ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#C2453E' }}>
                사건 목록을 불러오지 못했어요. 다시 시도한 뒤 경고를 주세요.
              </span>
              <Btn onClick={() => openFor(target)}>다시 시도</Btn>
            </div>
          ) : (
            <select
              value={picked}
              onChange={(e) => {
                setPicked(e.target.value);
                setNotice('');
              }}
              style={{
                height: 40,
                padding: '0 11px',
                borderRadius: 10,
                border: '1px solid #E3EBF7',
                fontSize: 13,
              }}
            >
              <option value="">특정 사건 아님 (자동 판정 사유에는 쓸 수 없어요)</option>
              {incidents.map((i) => (
                <option
                  key={`${i.kind}:${i.id}`}
                  value={encodeWarningIncident(i)}
                  disabled={i.already_warned}
                >
                  {i.label}
                  {i.already_warned ? ' · 이미 경고 있음' : ''}
                </option>
              ))}
            </select>
          )}

          {notice ? <span style={{ fontSize: 12, color: '#C2453E' }}>{notice}</span> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/*
              05 P6-1 · 06 「경고」 · Issue #47 부속 — 신고를 확인한 관리자가
              사용자 목록에서 수동으로 경고를 줄 때 직접 고르는 유형 두 가지.
              신고 사유(reports.reason)를 자동으로 옮기지 않는다 — 관리자가 신고
              내용을 보고 스스로 판단해서 고른다. 화면 라벨과 DB 저장값이 다르므로
              (report-rules.ts 와 같은 패턴 · warning-rules.ts) 라벨을 보여주고
              value 를 저장한다.
            */}
            {ADMIN_WARNING_REASONS.map(({ value, label }) => (
              <Btn
                key={value}
                tone="danger"
                disabled={incidentsPending}
                onClick={async () => {
                  // 05 P6 — 자동 경고와 겹칠 수 있는 사유는 사건을 골라야 한다.
                  // 서버도 같은 규칙을 다시 보지만(issueWarning), 먼저 알려준다.
                  if (requiresWarningIncident(value) && !picked) {
                    setNotice('이 경고는 관련 사건을 선택해야 해요.');
                    return;
                  }
                  try {
                    await issueWarning(target, value, decodeWarningIncident(picked));
                    setTarget(null);
                  } catch (error) {
                    alert(error instanceof Error ? error.message : '경고를 주지 못했어요.');
                  }
                }}
              >
                {label}
              </Btn>
            ))}
            <Btn onClick={() => setTarget(null)}>취소</Btn>
          </div>
        </div>
      ) : null}

      <Table cols={['가입', '이름', '학번', '호실', '이메일', '가입 방식', '경고', '제한', '상태', '']}>
        {rows.length === 0 ? (
          <EmptyRow span={10} text="가입한 사용자가 없어요." />
        ) : (
          rows.map((u) => (
            <tr key={u.user_id} id={`user-${u.user_id}`}>
              <td style={{ ...cell, color: '#8FAAD0' }}>{fmt(u.created_at, false)}</td>
              <td style={{ ...cell, fontWeight: 700 }}>{u.name}</td>
              <td style={cell}>{u.student_id}</td>
              <td style={cell}>{u.room}</td>
              <td style={{ ...cell, color: '#8FAAD0' }}>{u.email}</td>
              <td style={cell}>{u.signup_method}</td>
              <td style={cell}>
                {u.warning_count > 0 ? (
                  // Issue #28 — 경고 누적 사용자 탭의 같은 사용자 행으로 이동
                  <Link
                    href={`/admin?tab=warnings#user-${u.user_id}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <Gauge count={u.warning_count} />
                  </Link>
                ) : (
                  <Gauge count={0} />
                )}
              </td>
              <td style={cell}>
                <RestrictionBadge isRestricted={u.is_restricted} daysLeft={u.days_left} />
              </td>
              <td style={cell}>
                {u.withdraw_requested_at ? (
                  <>
                    <Dot color="#E52222" />
                    탈퇴 대기
                  </>
                ) : (
                  <>
                    <Dot color="#00BF40" />
                    정상
                  </>
                )}
              </td>
              <td style={cell}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn tone="danger" onClick={() => openFor(u.user_id)}>
                    경고 +1
                  </Btn>
                  <Btn onClick={() => revokeWarning(u.user_id)}>경고 −1</Btn>
                </div>
              </td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}
