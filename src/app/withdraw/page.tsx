// 탈퇴 복구 안내 (F36 · 05 P24 · 07 흐름표 「탈퇴 대기 계정으로 로그인하면 → 복구 안내」).
//
// P24 — 「탈퇴를 신청하면 즉시 이용이 정지되고 14일 동안 복구할 수 있다. 14일이 지나면
// 개인정보 · 이용 내역 · 경고 · 신고 · 알림을 영구 삭제한다.」
//
// 여기로 오는 길은 auth.config.ts 의 authorized 다 — 탈퇴를 신청한 사람이 홈 · 기록 ·
// 설정 어디로 가려 해도 이 화면으로 온다. 로그인 자체는 막지 않는다(그러면 복구할 길도
// 함께 막힌다).
//
// /history 와 같은 **서버 컴포넌트** 꼴이다. requireMe() 가 이미 withdrawRequestedAt 을
// 돌려주고 있었는데 아무도 보지 않던 값을 여기서 쓴다.

import Link from 'next/link';

import { requireMe } from '@/lib/queries';
import { WITHDRAW_GRACE_DAYS } from '@/lib/retention';
import RestoreButton from './restore-button';

export const dynamic = 'force-dynamic';

const SEOUL_TZ = 'Asia/Seoul';

// 날짜는 KST 로 보여준다 — 저장은 UTC(timestamptz)지만 사용자가 읽는 것은 한국 날짜다
// (08 · 4번 · /history 와 같은 방식).
const dateFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL_TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL_TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 남은 날짜 — KST 자정 기준으로 세어 "오늘 하루 남음" 이 어긋나지 않게 한다 */
function daysLeft(deleteAt: Date, now: Date): number {
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const start = new Date(`${dayKey.format(now)}T00:00:00Z`).getTime();
  const end = new Date(`${dayKey.format(deleteAt)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

const frame: React.CSSProperties = {
  width: '390px',
  height: '844px',
  margin: '40px auto',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  background: '#F3F6FB',
  color: '#1E3557',
  overflow: 'hidden',
  borderRadius: '40px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
};

const header: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '63px 20px 12px',
  background: '#fff',
  borderBottom: '1px solid #EAF0FA',
  width: '396px',
  height: '96px',
  position: 'relative',
};

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  border: '1px solid #E6EDF7',
  padding: '18px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '12px',
};

const rowLabel: React.CSSProperties = { fontSize: '13px', color: '#8FAAD0', flexShrink: 0 };
const rowValue: React.CSSProperties = { fontSize: '14px', fontWeight: 600, textAlign: 'right' };

const pageStyle = `
  body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; overflow: hidden; }
  html { overflow: hidden; }
  * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; box-sizing: border-box; }
  a { color: #2F63B8; text-decoration: none; }
  a:hover { color: #1F4E9C; }
  .no-scrollbar { scrollbar-width: none; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
`;

export default async function WithdrawPage() {
  const me = await requireMe();

  // 이미 복구된 계정. **redirect 하지 않는다** — 쿠키의 탈퇴 플래그가 아직 갱신되기
  // 전이면 auth.config 가 여기로 되돌려 보내 무한 redirect 가 된다. 안내만 띄우고
  // 사용자가 직접 홈으로 가게 한다(복구 버튼은 성공하면 세션을 새로 고친다).
  if (!me.withdrawRequestedAt) {
    return (
      <>
        <style>{pageStyle}</style>
        <div style={frame}>
          <div style={header}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>
              계정 복구
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <div style={{ ...card, alignItems: 'center', textAlign: 'center', gap: '14px' }}>
              <span style={{ fontSize: '17px', fontWeight: 800 }}>계정이 복구됐어요</span>
              <span style={{ fontSize: '13px', color: '#8FAAD0', lineHeight: 1.6 }}>
                이제 예전처럼 이용하실 수 있어요.
              </span>
              <Link
                href="/home"
                style={{
                  width: '100%',
                  textAlign: 'center',
                  color: '#fff',
                  background: '#4C86D8',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14.5px',
                  fontWeight: 700,
                }}
              >
                홈으로 가기
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const requestedAt = new Date(me.withdrawRequestedAt);
  const deleteAt = new Date(requestedAt);
  deleteAt.setDate(deleteAt.getDate() + WITHDRAW_GRACE_DAYS);

  const left = daysLeft(deleteAt, new Date());

  return (
    <>
      <style>{pageStyle}</style>

      <div style={frame}>
        {/* 홈 · 기록 · 설정의 로고 헤더가 아니라 /support 꼴의 제목 헤더를 쓴다 —
            이 화면에는 하단 탭도, 돌아갈 곳도 없다(탈퇴 대기 중에는 여기뿐이다). */}
        <div style={header}>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>
            회원탈퇴
          </span>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '24px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '5px' }}>
              <h1 style={{ margin: 0, fontSize: '25px', fontWeight: 800, letterSpacing: '-0.8px' }}>
                탈퇴 신청 상태예요
              </h1>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#8FAAD0', lineHeight: 1.6 }}>
                지금은 서비스 이용이 정지된 상태이고,
                <br />
                <b style={{ color: '#2F63B8' }}>{left}일</b> 안에 계정을 되돌릴 수 있어요.
              </p>
            </div>

            <div style={card}>
              <div style={rowStyle}>
                <span style={rowLabel}>탈퇴 신청일</span>
                <span style={rowValue}>{dateTimeFmt.format(requestedAt)}</span>
              </div>
              <div style={{ height: '1px', background: '#EDF2F9' }} />
              <div style={rowStyle}>
                <span style={rowLabel}>최종 삭제 예정일</span>
                <span style={{ ...rowValue, color: '#E0554E' }}>{dateFmt.format(deleteAt)}</span>
              </div>
            </div>

            <div
              style={{
                background: '#FEF6EC',
                border: '1px solid #F7E0C4',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#B4690E' }}>
                삭제 예정일이 지나면 되돌릴 수 없어요
              </span>
              <span style={{ fontSize: '12.5px', color: '#8A6A3D', lineHeight: 1.6 }}>
                개인정보 · 이용 내역 · 경고 · 신고 · 알림이 모두 영구 삭제됩니다. 복구 기간에는 같은 학교 이메일로 새로
                가입할 수 없어요.
              </span>
            </div>

            <div style={{ ...card, gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700 }}>계정을 계속 쓰고 싶으신가요?</span>
                <span style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>
                  아래 버튼을 누르면 탈퇴 신청이 취소되고 예전처럼 이용할 수 있어요.
                </span>
              </div>
              <RestoreButton />
            </div>

            <span style={{ textAlign: 'center', fontSize: '11.5px', color: '#A8BCD9' }}>Washed · 버전 1.0.0</span>
          </div>
        </div>
      </div>
    </>
  );
}
