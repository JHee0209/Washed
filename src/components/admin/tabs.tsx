// 관리자 콘솔의 탭 내용 — 표 일곱 개.
//
// 표 값(색 · 크기 · nowrap)은 docs/design/관리자.dc.html 그대로다.
// 바꾸는 단추는 전부 서버 액션을 부르고, 액션은 requireAdmin() 을 먼저 지난다.

'use client';

import { useState, useTransition } from 'react';

import {
  addMachine,
  addNotice,
  cancelQueue,
  clearRestriction,
  issueWarning,
  removeMachine,
  removeNotice,
  revokeWarning,
  setMachineStatus,
  setReportStatus,
} from '@/lib/admin-actions';

type Data = {
  machines: {
    machine_id: string;
    name: string;
    kind: string;
    status: string;
    minutes_left: number | null;
  }[];
  queue: {
    queue_id: string;
    user_name: string;
    room: string;
    machine_kind: string;
    machine_name: string | null;
    status: string;
    waited_minutes: number;
  }[];
  reports: {
    report_id: string;
    user_name: string;
    room: string;
    reason: string;
    machine_kind: string | null;
    machine_no: number | null;
    etc_content: string | null;
    status: string;
    created_at: string;
  }[];
  history: {
    history_id: string;
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
    last_reason: string | null;
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
  }[];
};

export default function AdminTabs({ tab, data }: { tab: string; data: Data }) {
  if (tab === 'dashboard') return <Machines rows={data.machines} />;
  if (tab === 'queue') return <Queue rows={data.queue} />;
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'plain' | 'danger' | 'primary';
}) {
  const [pending, start] = useTransition();
  const p = {
    plain: { bg: '#fff', fg: '#5A6E8F', bd: '#E3EBF7' },
    danger: { bg: '#fff', fg: '#C2453E', bd: '#F3C9C6' },
    primary: { bg: '#4C86D8', fg: '#fff', bd: '#4C86D8' },
  }[tone];

  return (
    <button
      onClick={() => start(onClick)}
      disabled={pending}
      style={{
        padding: '6px 11px',
        borderRadius: 9,
        border: `1px solid ${p.bd}`,
        background: p.bg,
        color: p.fg,
        cursor: pending ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        opacity: pending ? 0.5 : 1,
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

function Machines({ rows }: { rows: Data['machines'] }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('세탁기');
  const [pending, start] = useTransition();

  const color = (s: string) =>
    s === '사용가능' ? '#00BF40' : s === '사용중' ? '#2F63B8' : s === '고장' ? '#E52222' : '#FF9200';

  return (
    <>
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

      <Table cols={['기기', '종류', '상태', '남은 시간', '']}>
        {rows.length === 0 ? (
          <EmptyRow span={5} text="등록된 기기가 없어요. 위에서 추가해주세요." />
        ) : (
          rows.map((m) => (
            <tr key={m.machine_id}>
              <td style={{ ...cell, fontWeight: 700 }}>{m.name}</td>
              <td style={cell}>{m.kind}</td>
              <td style={cell}>
                <Dot color={color(m.status)} />
                {m.status}
              </td>
              <td style={{ ...cell, color: '#8FAAD0' }}>
                {m.minutes_left !== null ? `약 ${m.minutes_left}분` : '—'}
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
                  <Btn onClick={() => setMachineStatus(m.machine_id, '점검중')}>점검</Btn>
                  <Btn tone="danger" onClick={() => removeMachine(m.machine_id)}>
                    삭제
                  </Btn>
                </div>
              </td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}

// ─── 탭 2 · 실시간 대기열 (F23) ──────────────────────────────────────────────

function Queue({ rows }: { rows: Data['queue'] }) {
  return (
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
              <Dot color={q.status === '배정됨' ? '#FF9200' : '#2F63B8'} />
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
  );
}

// ─── 탭 3 · 신고 내역 (F27) ──────────────────────────────────────────────────

function Reports({ rows }: { rows: Data['reports'] }) {
  return (
    <Table cols={['접수', '신고자', '호실', '사유', '대상', '상태', '']}>
      {rows.length === 0 ? (
        <EmptyRow span={7} text="접수된 신고가 없어요." />
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
      </div>

      <Table cols={['사용자', '학번', '호실', '경고', '최근 사유', '제한', '']}>
        {rows.length === 0 ? (
          <EmptyRow span={7} text="경고를 받은 사용자가 없어요." />
        ) : (
          rows.map((w) => (
            <tr key={w.user_id}>
              <td style={{ ...cell, fontWeight: 700 }}>{w.user_name}</td>
              <td style={cell}>{w.student_id}</td>
              <td style={cell}>{w.room}</td>
              <td style={cell}>
                <Gauge count={w.warning_count} />
              </td>
              <td style={{ ...cell, color: '#8FAAD0' }}>{w.last_reason ?? '—'}</td>
              <td style={cell}>
                {w.is_restricted ? (
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
                    이용정지 · {w.days_left}일 남음
                  </span>
                ) : (
                  <span style={{ color: '#A8BCD9' }}>—</span>
                )}
              </td>
              <td style={cell}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn tone="danger" onClick={() => issueWarning(w.user_id, '관리자 부여')}>
                    경고 +1
                  </Btn>
                  <Btn onClick={() => revokeWarning(w.user_id)}>경고 −1</Btn>
                  {w.is_restricted ? (
                    <Btn tone="primary" onClick={() => clearRestriction(w.user_id)}>
                      제한 해제
                    </Btn>
                  ) : null}
                </div>
              </td>
            </tr>
          ))
        )}
      </Table>
    </>
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
  const [reason, setReason] = useState('');

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
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {rows.find((u) => u.user_id === target)?.name} 에게 경고
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="사유 (예: 배정 후 미이용)"
            style={{
              flex: '1 1 240px',
              height: 38,
              padding: '0 13px',
              borderRadius: 10,
              border: '1px solid #E3EBF7',
              fontSize: 13,
            }}
          />
          <Btn
            tone="primary"
            onClick={async () => {
              await issueWarning(target, reason);
              setTarget(null);
              setReason('');
            }}
          >
            경고 주기
          </Btn>
          <Btn onClick={() => setTarget(null)}>취소</Btn>
        </div>
      ) : null}

      <Table cols={['가입', '이름', '학번', '호실', '이메일', '가입 방식', '상태', '']}>
        {rows.length === 0 ? (
          <EmptyRow span={8} text="가입한 사용자가 없어요." />
        ) : (
          rows.map((u) => (
            <tr key={u.user_id}>
              <td style={{ ...cell, color: '#8FAAD0' }}>{fmt(u.created_at, false)}</td>
              <td style={{ ...cell, fontWeight: 700 }}>{u.name}</td>
              <td style={cell}>{u.student_id}</td>
              <td style={cell}>{u.room}</td>
              <td style={{ ...cell, color: '#8FAAD0' }}>{u.email}</td>
              <td style={cell}>{u.signup_method}</td>
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
                  <Btn tone="danger" onClick={() => setTarget(u.user_id)}>
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
