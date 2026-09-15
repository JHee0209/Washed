'use client';

// F40 · F41 — 로그인 뒤 홈 첫 진입에서 폰 알림 허용 받기 (05 P26)
//
// P26: 「허용은 로그인 뒤 홈에 처음 들어올 때 **한 번만** 묻고, 거절해도 앱은 그대로
// 쓸 수 있으며 설정에서 다시 켤 수 있다.」
//
// "한 번만 묻는다" 를 서버에 적지 않는다 — 06 에 저장 칸이 없고, 허용 여부는 이미
// 브라우저의 Notification.permission 이 기억한다. 서버에 남는 것은 "허용했는지" 가
// 아니라 "구독 정보가 있는지" 뿐이다(06 「푸시 구독」). 그래서 "물어봤다" 는 표시만
// 기기에 남긴다 — 언어 설정(washed_lang)과 같은 방식이다.
//
// 아이폰은 사파리로 열어 둔 상태에서는 폰 알림이 오지 않는다. 홈 화면에 추가해야
// 받으므로 여기서 안내한다 (F41 · 08 · 195줄).
//
// 이 안내는 P13(차례 10분 전 · 이용 가능)의 종류별 설정과 **다른 것**이다.
// 여기는 운영체제 단위 허용이고, 종류별 설정은 v2 다 (P26 · 06 · 42줄).

import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  askedServerSnapshot,
  askedSnapshot,
  enablePush,
  installGuideSeenServerSnapshot,
  installGuideSeenSnapshot,
  iosNeedsInstallServerSnapshot,
  iosNeedsInstallSnapshot,
  markAsked,
  markInstallGuideSeen,
  permissionServerSnapshot,
  permissionSnapshot,
  subscribePushState,
  syncPushSubscription,
} from '@/lib/push-client';

export default function NotificationPrompt() {
  const [pending, setPending] = useState(false);

  // 허용 상태는 React 밖(브라우저)에 있다. 효과 안에서 state 로 옮겨 담으면
  // 렌더가 한 번 더 돌고 서버 렌더와도 어긋나므로 바깥 상태를 그대로 구독한다.
  const permission = useSyncExternalStore(
    subscribePushState,
    permissionSnapshot,
    permissionServerSnapshot,
  );
  const asked = useSyncExternalStore(subscribePushState, askedSnapshot, askedServerSnapshot);
  const iosNeedsInstall = useSyncExternalStore(
    subscribePushState,
    iosNeedsInstallSnapshot,
    iosNeedsInstallServerSnapshot,
  );
  const installGuideSeen = useSyncExternalStore(
    subscribePushState,
    installGuideSeenSnapshot,
    installGuideSeenServerSnapshot,
  );

  // 이미 허용한 기기면 서버에 구독이 남아 있도록 조용히 맞춘다.
  // (열쇠가 회전되거나 서버 행이 지워졌을 수 있다.)
  useEffect(() => {
    if (permission === 'granted') syncPushSubscription();
  }, [permission]);

  async function allow() {
    setPending(true);
    try {
      await enablePush();
    } catch (error) {
      console.error('알림 등록 실패', error);
    } finally {
      // 허용하든 거절하든 다시 묻지 않는다 (P26 — 한 번만).
      markAsked();
      setPending(false);
    }
  }

  const card: React.CSSProperties = {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 20,
    background: '#fff',
    border: '1px solid #E6EDF7',
    borderRadius: 18,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 14px 30px -10px rgba(47,99,184,.34)',
  };
  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 800,
    color: '#1E3557',
  };
  const bodyStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: '#8FAAD0',
    lineHeight: 1.6,
  };
  const ghostButton: React.CSSProperties = {
    flex: 1,
    border: 'none',
    cursor: 'pointer',
    color: '#5A7CA8',
    background: '#fff',
    boxShadow: 'inset 0 0 0 1px #CFDDF2',
    borderRadius: 12,
    padding: '12px',
    fontSize: 13.5,
    fontWeight: 700,
  };
  const primaryButton: React.CSSProperties = {
    flex: 1,
    border: 'none',
    cursor: pending ? 'default' : 'pointer',
    color: '#fff',
    background: pending ? '#A8BCD9' : '#4C86D8',
    borderRadius: 12,
    padding: '12px',
    fontSize: 13.5,
    fontWeight: 700,
  };

  // 아이폰을 사파리로 연 상태 — 허용을 물어봐도 알림이 오지 않는다.
  // 먼저 홈 화면에 추가하는 법을 알린다 (F41).
  //
  // 이 안내를 닫는 것은 **허용을 물어본 것이 아니다.** 그래서 washed_push_asked 가
  // 아니라 washed_push_install_guide_seen 을 쓴다 — 홈 화면에 추가해 앱으로 다시
  // 열면 그때 아래의 진짜 허용 안내가 뜬다.
  if (iosNeedsInstall) {
    if (installGuideSeen) return null;
    return (
      <div style={card}>
        <span style={titleStyle}>홈 화면에 추가하면 알림을 받을 수 있어요</span>
        <span style={bodyStyle}>
          사파리 아래쪽 <b>공유</b>를 누르고 <b>&lsquo;홈 화면에 추가&rsquo;</b>를 고르면
          차례와 종료 알림을 폰으로 받을 수 있어요.
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={markInstallGuideSeen} style={primaryButton}>
            확인했어요
          </button>
        </div>
      </div>
    );
  }

  // 여기부터가 **실제 허용 안내**다. 05 P26 의 "한 번만 묻는다" 가 걸리는 자리다.
  if (asked) return null;

  // 브라우저가 이미 허용 · 거절을 기억하고 있으면 묻지 않는다.
  // 거절한 사람은 설정 화면의 "알림이 꺼져 있어요" 줄에서 다시 켠다 (P26).
  if (permission !== 'default') return null;

  return (
    <div style={card}>
      <span style={titleStyle}>차례가 되면 알려드릴게요</span>
      <span style={bodyStyle}>
        배정 · 종료 알림을 폰 알림으로 받을 수 있어요. 거절해도 앱은 그대로 쓸 수 있고,
        설정에서 다시 켤 수 있어요.
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={markAsked} style={ghostButton}>
          나중에
        </button>
        <button type="button" onClick={allow} disabled={pending} style={primaryButton}>
          {pending ? '등록 중…' : '허용하기'}
        </button>
      </div>
    </div>
  );
}
