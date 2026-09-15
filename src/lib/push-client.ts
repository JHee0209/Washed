// 브라우저에서 푸시 구독을 만들고 서버에 저장한다 (F40 · 06 「푸시 구독」).
// 홈 첫 진입 배너와 설정의 "알림이 꺼져 있어요" 줄이 같은 코드를 쓴다.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true)
  );
}

export function iosNeedsInstallSnapshot(): boolean {
  return isIos() && !isStandalone();
}

export function iosNeedsInstallServerSnapshot(): boolean {
  return false;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

// ---------------------------------------------------------------------------
// 허용 상태 읽기 — useSyncExternalStore 용
//
// 허용 여부는 React 밖(브라우저)에 있다. 효과 안에서 setState 로 옮겨 담으면
// 렌더가 한 번 더 돌고(react-hooks/set-state-in-effect) 서버 렌더와도 어긋나므로,
// **바깥 상태를 그대로 구독**한다. 브라우저가 허용 상태 변경을 알려주지 않기 때문에
// 우리가 바꾼 순간(enablePush · markAsked)에만 직접 알린다.
// ---------------------------------------------------------------------------

export type PushPermission = NotificationPermission | 'unsupported';

/**
 * 실제 **허용을 물어봤는지** (기기 단위 · 05 P26 · washed_lang 과 같은 방식).
 * "한 번만 묻는다" 가 걸리는 자리는 여기 하나다.
 */
const ASKED_KEY = 'washed_push_asked';

/**
 * 아이폰 홈 화면 추가 안내를 **읽었는지** (F41).
 *
 * 위의 ASKED_KEY 와 섞지 않는다. 사파리로 연 아이폰에서는 허용을 물어봐야
 * 알림이 오지 않으므로 설치 안내부터 하는데, 그 안내를 닫았다고 해서
 * "허용을 물어봤다" 가 되면 안 된다 — 홈 화면에 추가해 앱으로 다시 열었을 때
 * 정작 허용 안내가 영영 뜨지 않는다.
 */
const INSTALL_GUIDE_KEY = 'washed_push_install_guide_seen';

let listeners: (() => void)[] = [];

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePushState(callback: () => void): () => void {
  listeners = [...listeners, callback];
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

export function permissionSnapshot(): PushPermission {
  return pushSupported() ? Notification.permission : 'unsupported';
}

/** 서버 렌더에는 브라우저가 없다 — 아직 아무것도 묻지 않은 상태로 그린다. */
export function permissionServerSnapshot(): PushPermission {
  return 'default';
}

export function askedSnapshot(): boolean {
  try {
    return !!window.localStorage.getItem(ASKED_KEY);
  } catch {
    return true; // 저장소를 못 쓰면 묻지 않는다(매번 묻는 것보다 낫다)
  }
}

/** 서버에서는 "이미 물어본 것" 으로 둔다 — 깜빡했다가 사라지는 배너를 막는다. */
export function askedServerSnapshot(): boolean {
  return true;
}

export function markAsked(): void {
  try {
    window.localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // 저장소를 못 써도 이번 화면에서는 배너가 닫힌다
  }
  emit();
}

/** 홈 화면 추가 안내를 이미 읽었는지 (F41) */
export function installGuideSeenSnapshot(): boolean {
  try {
    return !!window.localStorage.getItem(INSTALL_GUIDE_KEY);
  } catch {
    return true; // 저장소를 못 쓰면 매번 띄우지 않는다
  }
}

/** 서버 렌더에는 브라우저가 없다 — 깜빡였다 사라지는 안내를 막는다. */
export function installGuideSeenServerSnapshot(): boolean {
  return true;
}

/**
 * 홈 화면 추가 안내를 읽었다고 표시한다.
 * **허용을 물어본 것과는 다르다** — markAsked() 를 부르지 않는다.
 */
export function markInstallGuideSeen(): void {
  try {
    window.localStorage.setItem(INSTALL_GUIDE_KEY, '1');
  } catch {
    // 저장소를 못 써도 이번 화면에서는 안내가 닫힌다
  }
  emit();
}

/**
 * 허용을 묻고, 허용했으면 구독을 만들어 서버에 저장한다.
 * 브라우저가 이미 거절을 기억하고 있으면 창이 뜨지 않고 바로 'denied' 가 돌아온다 —
 * 그때는 폰의 사이트 설정에서 직접 켜야 한다.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (!pushSupported()) return 'denied';

  const permission = await Notification.requestPermission();
  emit();
  if (permission !== 'granted') return permission;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY 가 없습니다.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  // fetch 는 401 · 500 에도 resolve 한다. 여기서 ok 를 보지 않으면 브라우저가
  // 허용했다는 것만으로 성공처럼 끝나고, 서버에는 구독이 없어 알림이 오지 않는다.
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) {
    const message = await res
      .json()
      .then((data: { message?: string }) => data?.message)
      .catch(() => undefined);
    throw new Error(message ?? `구독 정보를 저장하지 못했어요. (${res.status})`);
  }

  return permission;
}

/**
 * 이미 권한이 있는 경우(granted), 기기 구독이 서버에 확실히 저장되어 있도록 동기화한다.
 */
export async function syncPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    if (subscription) {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      // 배경 동기화라 밖으로 던지지는 않지만, 4xx · 5xx 를 성공으로 보지는 않는다.
      if (!res.ok) throw new Error(`구독 동기화 실패 (${res.status})`);
    }
  } catch (error) {
    console.error('푸시 구독 동기화 실패', error);
  }
}
