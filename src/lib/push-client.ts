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

/**
 * 허용 상태를 다시 읽게 한다.
 *
 * 브라우저는 사이트 설정에서 허용이 바뀌어도 알려 주지 않는다. 사용자가 주소창
 * 자물쇠에서 직접 켜고 돌아오는 길이 실제로 있으므로(조용한 권한 UI), 화면이
 * 다시 보일 때 이걸 불러 스냅샷을 새로 읽는다.
 */
export function refreshPushPermission(): void {
  emit();
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
 * 허용 창이 끝내 뜨지 않을 때 기다리기를 멈추는 시간.
 *
 * 크롬의 "조용한 알림 권한 UI" 에서는 모달이 뜨지 않고 주소창에 종 아이콘만
 * 생기는데, 그때 requestPermission() 이 준 약속은 사용자가 그 아이콘을 누를
 * 때까지 **영영 풀리지 않는다**. 그대로 기다리면 화면이 "등록 중…" 에 갇힌다.
 */
const PERMISSION_PROMPT_TIMEOUT_MS = 15_000;

/**
 * 허용을 묻되, 답이 오지 않으면 그 시점의 허용 상태로 끝낸다.
 *
 * 제한 시간에 걸려도 보통 'default' 가 돌아오므로 호출부는 "창이 뜨지 않았다" 로
 * 처리하면 된다. 뒤늦게 풀릴 수도 있는 원래 약속은 여기서 버린다 — 구독 단계로
 * 이어지지 않으므로 나중에 허용되더라도 구독이 두 번 만들어지지 않는다.
 * (그 경우는 refreshPushPermission() 으로 다시 읽어 조용히 동기화한다.)
 */
async function requestPermissionWithTimeout(): Promise<NotificationPermission> {
  return Promise.race([
    Notification.requestPermission(),
    new Promise<NotificationPermission>((resolve) => {
      window.setTimeout(() => resolve(Notification.permission), PERMISSION_PROMPT_TIMEOUT_MS);
    }),
  ]);
}

// ---------------------------------------------------------------------------
// 사용자의 명시적 OFF 의사 (Issue #68)
//
// Notification.permission 을 대신하는 값이 아니다 — 권한은 브라우저가 쥐고
// 있고 코드로 되돌릴 수 없다(05 P26). 이 플래그는 오직 "사용자가 설정에서
// Washed 알림을 직접 껐다" 는 의사만 기억한다. 목적은 하나 — 권한이 여전히
// granted 인 채로 홈에 돌아왔을 때 NotificationPrompt 의 자동 동기화
// (syncPushSubscription)가 조용히 다시 구독시키지 않게 막는 것이다.
// 플래그가 없는 기본 상태에서는 기존 동작과 완전히 같다.
// ASKED_KEY 와 같은 이유로 try/catch 로 감싼다 — 서버 렌더에는 window 가 없다.
// ---------------------------------------------------------------------------

const DISABLED_KEY = 'washed_push_disabled';

function isPushDisabledByUser(): boolean {
  try {
    return !!window.localStorage.getItem(DISABLED_KEY);
  } catch {
    return false; // 저장소를 못 읽으면 기존 동작(자동 동기화)을 따른다
  }
}

function setPushDisabledByUser(disabled: boolean): void {
  try {
    if (disabled) window.localStorage.setItem(DISABLED_KEY, '1');
    else window.localStorage.removeItem(DISABLED_KEY);
  } catch {
    // 저장소를 못 써도 이번 세션 동안은 메모리 값 없이 그냥 넘어간다
  }
}

/**
 * 지금 이 브라우저에 실제로 있는 PushSubscription — 없으면 null.
 *
 * enablePush()/syncPushSubscription() 과 달리 **새로 구독을 만들지 않는다.**
 * Issue #68 — 설정 화면의 ON/OFF 는 Notification.permission 이 아니라 이 값을
 * 기준으로 판정해야 한다(권한은 granted 여도 구독이 없을 수 있다).
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * 허용을 묻고, 허용했으면 구독을 만들어 서버에 저장한다.
 * 브라우저가 이미 거절을 기억하고 있으면 창이 뜨지 않고 바로 'denied' 가 돌아온다 —
 * 그때는 폰의 사이트 설정에서 직접 켜야 한다.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (!pushSupported()) return 'denied';

  const permission = await requestPermissionWithTimeout();
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

  // Issue #68 — 실제 구독·서버 저장까지 끝난 뒤에만 "껐다" 는 의사를 지운다.
  // 여기서 던지고 나가면(위) 아래 줄을 타지 않으므로, 실패했을 때는 의사가
  // 남아 있던 대로 유지된다(요청하신 대로 임의로 풀지 않는다).
  setPushDisabledByUser(false);

  return permission;
}

/**
 * 이미 권한이 있는 경우(granted), 기기 구독이 서버에 확실히 저장되어 있도록 동기화한다.
 *
 * Issue #68 — 사용자가 설정에서 명시적으로 껐다면(disablePush) 아무것도 하지
 * 않는다. permission 은 계속 'granted' 로 남을 수 있으므로, 이 가드가 없으면
 * 홈에 돌아올 때마다(NotificationPrompt) 방금 끈 구독이 조용히 되살아난다.
 */
export async function syncPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  if (isPushDisabledByUser()) return;

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

/**
 * Washed 알림을 끈다 (Issue #68).
 *
 * 05 P26 — 브라우저 권한(Notification.permission) 자체는 코드로 되돌릴 수
 * 없다. 여기서 끄는 것은 **Washed 의 구독**(PushSubscription)이지 운영체제
 * 허용이 아니다 — 실행 뒤에도 permission 은 계속 'granted' 로 남을 수 있다.
 *
 * 불변식은 항상 "UI ON = 실제 브라우저 PushSubscription 존재" 다. 그래서 이
 * 함수는 성공 여부를 boolean 으로 알리지 않는다 — 호출부는 매번
 * getCurrentSubscription() 을 다시 불러 실제 상태로 화면을 그린다(낙관적으로
 * 미리 OFF 로 바꾸지 않는다).
 *
 * 순서 · 실패 처리:
 *  1) 구독이 이미 없으면 — 지울 서버 행도 없다. "껐다" 는 의사만 남기고
 *     멱등적으로 끝낸다(서버 요청 자체를 보내지 않는다).
 *  2) 있으면 endpoint 를 먼저 확보하고, unsubscribe 를 부르기 **직전에** 의사
 *     플래그부터 켠다 — syncPushSubscription() 이 그 사이에 끼어들어 도로
 *     구독시키는 경합을 막는다.
 *  3) 브라우저 unsubscribe 가 실패(예외 또는 false)하면: 의사 플래그를 다시
 *     내리고 서버 DELETE 는 시도하지 않는다 — 실제 구독이 그대로 남아 있으므로
 *     "껐다" 고 기억해 두면 자동 동기화만 막힌 채 화면과 실제 상태가 어긋난다.
 *     사용자는 다시 OFF 를 시도할 수 있다.
 *  4) 브라우저 unsubscribe 가 성공하면 그때만 서버 DELETE 를 시도한다. 이
 *     DELETE 가 실패해도 의사 플래그는 그대로 둔다 — 실제 브라우저 구독은
 *     이미 없으므로 UI 는 OFF 가 맞고, 서버에 남는 stale 행은 발송 실패 시
 *     지우는 기존 정책(05 P26 · src/lib/push.ts 의 404·410 정리)이 있다.
 */
export async function disablePush(): Promise<void> {
  const subscription = await getCurrentSubscription();

  if (!subscription) {
    setPushDisabledByUser(true);
    return;
  }

  const endpoint = subscription.endpoint;

  // 자동 재구독 경합 방지 — 실제로 끊기 전에 먼저 "껐다" 로 표시해 둔다.
  setPushDisabledByUser(true);

  let unsubscribed = false;
  try {
    unsubscribed = await subscription.unsubscribe();
  } catch (error) {
    console.error('푸시 구독 해제 실패(브라우저)', error);
  }

  if (!unsubscribed) {
    // 실제 구독이 살아 있다 — 의사 표시를 되돌려 자동 동기화도 정상으로 둔다.
    setPushDisabledByUser(false);
    return;
  }

  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) throw new Error(`구독 삭제 실패 (${res.status})`);
  } catch (error) {
    console.error('푸시 구독 삭제 실패(서버)', error);
  }
}
