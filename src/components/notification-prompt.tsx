'use client';

// F40 · F41 — 로그인 뒤 홈 첫 진입에서 폰 알림 허용 받기 (05 P26)
//
// 홈에 처음 들어와 아직 허용을 묻지 않았다면 **먼저 눈에 들어오는 모달**을 띄운다.
// 프레임 전체를 덮어 뒤의 QR · 대기열 · 설정 · 알림까지 눌리지 않게 한다.
// (home/page.tsx 의 폰 프레임이 position:relative 라 여기 오버레이 하나로 덮인다 —
// 홈 화면 쪽은 손대지 않는다.)
//
// 다만 **막아 두지는 않는다.** P26: 「거절해도 앱은 그대로 쓸 수 있으며 설정에서
// 다시 켤 수 있다.」 그래서 어느 상태에서든 모달을 닫고 홈으로 갈 수 있는 버튼이
// 반드시 하나 있다 — 거절했을 때도, 허용 창이 끝내 뜨지 않았을 때도 마찬가지다.
//
// 브라우저 정책상 **native 허용 창은 사용자의 클릭 안에서만** 띄울 수 있다. 그래서
// 화면에 들어오자마자 requestPermission() 을 부르지 않는다 — 우리 모달만 자동으로
// 띄우고, 그 안의 버튼을 누를 때 같은 클릭 흐름에서 요청한다.
//
// "허용을 물어봤다" 를 서버에 적지 않는다 — 06 에 저장 칸이 없고, 허용 여부는 이미
// 브라우저의 Notification.permission 이 기억한다. 서버에 남는 것은 "구독 정보가
// 있는지" 뿐이다(06 「푸시 구독」). 그래서 "물어봤다(= 닫았다)" 는 표시만 기기에
// 남긴다 — 이게 P26 의 "한 번만 묻는다" 가 걸리는 자리다.
//
// 아이폰은 사파리로 열어 둔 상태에서는 폰 알림이 아예 오지 않는다. 그쪽은 허용을
// 받을 방법 자체가 없으므로 막지 않고 설치 안내만 한다 (F41 · 08 · 195줄).
//
// 이 안내는 P13(차례 10분 전 · 이용 가능)의 종류별 설정과 **다른 것**이다.
// 여기는 운영체제 단위 허용이고, 종류별 설정은 v2 다 (P26 · 06 · 42줄).

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

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
  refreshPushPermission,
  subscribePushState,
  syncPushSubscription,
} from '@/lib/push-client';

// 서버 렌더에는 브라우저가 없어 허용 상태를 읽을 수 없다. 읽기 전까지는 아무것도
// 그리지 않는다 — 이미 허용한 사람 앞에서 모달이 한 번 깜빡이는 것을 막는다.
// (화면 상태 1 「허용 상태 확인 중」)
const hydratedSnapshot = () => true;
const hydratedServerSnapshot = () => false;

export default function NotificationPrompt() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 허용 상태는 React 밖(브라우저)에 있다. 효과 안에서 state 로 옮겨 담으면
  // 렌더가 한 번 더 돌고 서버 렌더와도 어긋나므로 바깥 상태를 그대로 구독한다.
  const hydrated = useSyncExternalStore(
    subscribePushState,
    hydratedSnapshot,
    hydratedServerSnapshot,
  );
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

  // 허용 · 거절이 정해진 뒤의 마무리(구독 저장 · 새로고침)는 **딱 한 번만** 돈다.
  // 결과는 네 곳(요청 반환값 · Permissions 변경 · focus · visibilitychange)에서
  // 동시에 감지될 수 있어서, 잠금이 없으면 새로고침이 여러 번 걸린다.
  const finalizingRef = useRef(false);

  // 아직 아무것도 정해지지 않아 물어봐야 하는 상태인지 (= 모달이 떠 있는지)
  const needsAsk =
    hydrated && !iosNeedsInstall && permission === 'default' && !asked;

  /**
   * 허용 · 거절이 정해졌다. 저장할 것을 먼저 저장하고 나서 화면을 새로 연다.
   *
   * **순서가 중요하다** — 새로고침이 먼저 걸리면 구독 저장 요청이 중간에 끊긴다.
   */
  async function finalizePermissionChange(alreadySynced: boolean) {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    try {
      if (permissionSnapshot() === 'granted' && !alreadySynced) {
        await syncPushSubscription();
      }
    } finally {
      window.location.reload();
    }
  }

  // 이미 허용한 기기면 서버에 구독이 남아 있도록 조용히 맞춘다.
  // (열쇠가 회전되거나 서버 행이 지워졌을 수 있다.)
  useEffect(() => {
    // allow()가 이미 enablePush()로 구독/저장을 진행 중일 때 같은 registration에
    // syncPushSubscription()이 동시에 끼어들면 두 흐름이 경쟁하다 enablePush()
    // 쪽이 settle되지 않아 "등록 중..."이 영영 풀리지 않는 경우가 있었다.
    // 마무리 중일 때도 같은 이유로 비켜선다.
    if (permission === 'granted' && !pending && !finalizingRef.current) {
      syncPushSubscription();
    }
  }, [permission, pending]);

  // 조용한 권한 UI(주소창 알림 아이콘) 대응 — 그 UI 에서 고른 결과는
  // requestPermission() 이 돌려주지 않을 수 있다. 모달이 떠 있는 동안에만
  // 지켜보다가, default 를 벗어나면 선택이 끝난 것으로 본다.
  useEffect(() => {
    if (!needsAsk) return;

    const check = () => {
      const current = permissionSnapshot();
      if (current === 'granted' || current === 'denied') {
        // 여기서는 일부러 다시 그리지 않는다 — 곧 새로고침이 걸리고,
        // 다시 그리면 위 동기화 효과와 겹친다.
        void finalizePermissionChange(false);
        return;
      }
      refreshPushPermission();
    };

    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);

    // Permissions API 는 브라우저마다 지원이 갈린다 — 있으면 쓰고, 없으면
    // 위의 focus · visibilitychange 로도 충분히 잡힌다.
    let status: PermissionStatus | undefined;
    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((result) => {
        status = result;
        result.addEventListener('change', check);
      })
      .catch(() => {
        // 이 브라우저는 알림 권한을 Permissions API 로 못 읽는다 — 무시한다
      });

    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      status?.removeEventListener('change', check);
    };
  }, [needsAsk]);

  async function allow() {
    if (pending) return; // 등록 중 중복 클릭 방지
    setPending(true);
    setNotice(null);
    try {
      // 이 호출까지가 클릭과 같은 흐름이다 — enablePush() 는 다른 일을 하기 전에
      // Notification.requestPermission() 부터 부른다. 여기서 native 창이 뜬다.
      const result = await enablePush();

      // granted 면 enablePush() 안에서 구독 저장까지 이미 끝났다.
      if (result === 'granted') return void finalizePermissionChange(true);
      if (result === 'denied') return void finalizePermissionChange(false);

      // 'default' — 창이 뜨지 않았거나(조용한 권한 UI) 사용자가 그냥 닫았다.
      // "등록 중…" 으로 남기지 않고 다시 시도하거나 넘어갈 수 있게 한다.
      setNotice(
        '알림 창이 뜨지 않았어요. 주소창의 알림 아이콘에서 고르거나, 「다시 시도」를 눌러주세요.',
      );
    } catch (error) {
      console.error('알림 등록 실패', error);
      // 허용은 됐는데 저장에만 실패했을 수 있다 — 그때는 마무리로 넘긴다.
      if (permissionSnapshot() === 'granted') return void finalizePermissionChange(false);
      setNotice('알림을 켜지 못했어요. 「다시 시도」를 누르거나 나중에 설정에서 켤 수 있어요.');
    } finally {
      // 어떤 경로로 끝나든 여기서 반드시 풀린다.
      setPending(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 100,
    background: 'rgba(30, 53, 87, .45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
  };
  const card: React.CSSProperties = {
    width: '100%',
    background: '#fff',
    border: '1px solid #E6EDF7',
    borderRadius: 18,
    padding: '18px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 14px 30px -10px rgba(47,99,184,.34)',
  };
  const bottomCard: React.CSSProperties = {
    ...card,
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    width: 'auto',
    zIndex: 20,
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
  const noticeStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: '#C2603F',
    lineHeight: 1.6,
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

  // 화면 상태 1 — 아직 허용 상태를 읽지 못했다.
  if (!hydrated) return null;

  // 아이폰을 사파리로 연 상태 — 허용을 물어봐도 알림이 오지 않는다. 받을 방법이
  // 없으므로 **막지 않고** 홈 화면에 추가하는 법만 알린다 (F41).
  //
  // 이 안내를 닫는 것은 **허용을 물어본 것이 아니다.** 그래서
  // washed_push_install_guide_seen 을 쓴다 — 홈 화면에 추가해 앱으로 다시 열면
  // 그때 진짜 허용 모달이 뜬다.
  if (iosNeedsInstall) {
    if (installGuideSeen) return null;
    return (
      <div style={bottomCard}>
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

  // 폰 알림을 지원하지 않는 브라우저 — 켤 방법이 없으니 막지 않는다.
  if (permission === 'unsupported') return null;

  // 화면 상태 5 — 이미 허용됐다. 모달 없이 홈을 그대로 쓴다.
  // (구독 동기화는 위 효과가 조용히 맞춘다.)
  if (permission === 'granted') return null;

  // 05 P26 — 차단한 사람을 모달로 붙잡지 않는다. 홈을 그대로 쓰고, 설정 화면의
  // "알림이 꺼져 있어요" 줄에서 다시 켠다.
  if (permission === 'denied') return null;

  // 05 P26 — 한 번 묻고 닫았으면 다시 묻지 않는다. 새로고침해도 마찬가지다.
  if (asked) return null;

  // 화면 상태 2 · 3 — 아직 묻지 않았다. 버튼을 눌러야 native 창이 뜬다.
  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="push-modal-title">
      <div style={card}>
        <span id="push-modal-title" style={titleStyle}>
          차례가 되면 알려드릴게요
        </span>
        <span style={bodyStyle}>
          알림을 허용하면 배정 및 사용 종료 알림을 받을 수 있어요. 허용하지 않아도
          앱은 그대로 쓸 수 있고, 설정에서 다시 켤 수 있어요.
        </span>
        {notice ? <span style={noticeStyle}>{notice}</span> : null}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* 등록 중에도 닫을 수 있다 — 허용 창이 끝내 뜨지 않는 환경에서도
              사용자가 갇히지 않아야 한다 (P26). */}
          <button type="button" onClick={markAsked} style={ghostButton}>
            나중에
          </button>
          <button type="button" onClick={allow} disabled={pending} style={primaryButton}>
            {pending ? '등록 중…' : notice ? '다시 시도' : '알림 허용하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
