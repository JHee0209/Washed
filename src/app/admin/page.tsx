// F23~F29 관리자 콘솔 — docs/design/관리자.dc.html
//
// 탭 일곱 개를 전부 옮겼다.
//   1 실시간 기기 현황   2 실시간 대기열 현황   3 신고 내역   4 이용 내역
//   5 경고 누적 사용자   6 공지사항            7 사용자 목록
//
// 프로토타입이 localStorage 에서 읽던 값을 전부 DB 에서 읽는다 (08 · 2번).
// 2026-09-15 디자인 갱신분(white-space: nowrap · 가로 스크롤)도 그대로 반영했다 —
// 다국어로 바꿨을 때 표가 두 줄로 접히던 자리다.

import Link from 'next/link';

import { logoutAction } from './login/actions';
import AdminTabs from '@/components/admin/tabs';
import { requireAdmin } from '@/lib/admin-session';
import {
  adminHistory,
  adminMachines,
  adminNotices,
  adminQueue,
  adminReports,
  adminUsers,
  adminWarnings,
} from '@/lib/admin-actions';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'dashboard', label: '실시간 기기 현황' },
  { key: 'queue', label: '실시간 대기열 현황' },
  { key: 'reports', label: '신고 내역' },
  { key: 'history', label: '이용 내역' },
  { key: 'warnings', label: '경고 누적 사용자' },
  { key: 'notice', label: '공지사항' },
  { key: 'users', label: '사용자 목록' },
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const admin = await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : 'dashboard';

  // 탭마다 필요한 것만 읽는다 — 일곱 개를 매번 다 읽지 않는다
  const data = {
    machines: tab === 'dashboard' ? await adminMachines() : [],
    queue: tab === 'queue' ? await adminQueue() : [],
    reports: tab === 'reports' ? await adminReports() : [],
    history: tab === 'history' ? await adminHistory() : [],
    warnings: tab === 'warnings' ? await adminWarnings() : [],
    notices: tab === 'notice' ? await adminNotices() : [],
    users: tab === 'users' ? await adminUsers() : [],
  };

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#F3F6FB' }}>
      {/* 사이드바 */}
      <aside
        style={{
          width: 226,
          flexShrink: 0,
          background: '#fff',
          borderRight: '1px solid #EAF0FA',
          padding: '22px 14px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: '#2F63B8',
            letterSpacing: -0.4,
            padding: '0 10px 18px',
            whiteSpace: 'nowrap',
          }}
        >
          Washed 관리자
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/admin?tab=${t.key}`}
                style={{
                  padding: '11px 12px',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: on ? 700 : 500,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  background: on ? 'rgba(47,99,184,.08)' : 'transparent',
                  color: on ? '#2F63B8' : '#37383C',
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          <div
            style={{
              fontSize: 11.5,
              color: '#A8BCD9',
              padding: '0 12px 10px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {admin.loginId}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #E3EBF7',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#5A6E8F',
              }}
            >
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      {/* 본문 — 표가 창보다 넓으면 가로 스크롤 (2026-09-15 갱신) */}
      <main style={{ flex: 1, minWidth: 0, overflowX: 'auto', padding: '26px 24px' }}>
        <h1
          style={{
            margin: '0 0 20px',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: -0.4,
            color: '#1E3557',
            whiteSpace: 'nowrap',
          }}
        >
          {TABS.find((t) => t.key === tab)?.label}
        </h1>

        <AdminTabs tab={tab} data={data} />
      </main>
    </div>
  );
}
