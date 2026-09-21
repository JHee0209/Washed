// 「계정 복구」 버튼 (F36 · 05 P24).
//
// 복구 안내 화면(page.tsx)은 서버 컴포넌트라 버튼만 갈라 둔다.
//
// ── update() 를 부르는 이유
// 로그인 상태는 서명된 JWT 쿠키다(06 「세션은 저장 항목이 아니다」). DB 에서
// withdraw_requested_at 을 비워도 **쿠키 안의 플래그는 그대로**라, 엣지에서 도는
// auth.config 의 authorized 가 여전히 이 화면으로 되돌려 보낸다. useSession 의
// update() 가 jwt 콜백을 다시 돌려(그 콜백은 매번 users 를 읽는다) 쿠키를 새로 발급
// 받게 한다. 그 다음에 홈으로 옮긴다 — 순서를 바꾸면 홈에서 다시 튕겨 나온다.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

import { useT } from '@/lib/i18n/use-t';
import { cancelWithdrawal } from '@/lib/user-actions';

export default function RestoreButton() {
  const t = useT();
  const router = useRouter();
  const { update } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const handleRestore = async () => {
    if (pending) return;
    setPending(true);
    setError('');

    try {
      await cancelWithdrawal();
    } catch {
      setPending(false);
      // 14일이 지나 되돌릴 수 없는 경우도 여기로 온다 (user-actions.ts).
      setError(t('withdraw.restoreFailed'));
      return;
    }

    // 쿠키를 새로 받은 뒤에 옮긴다.
    await update();
    router.replace('/home');
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        onClick={handleRestore}
        disabled={pending}
        style={{
          width: '100%',
          border: 'none',
          cursor: pending ? 'default' : 'pointer',
          color: pending ? '#A8BCD9' : '#fff',
          background: pending ? '#EDF2FA' : '#4C86D8',
          borderRadius: '12px',
          padding: '14px',
          fontSize: '14.5px',
          fontWeight: 700,
        }}
      >
        {pending ? t('withdraw.restoring') : t('withdraw.restoreButton')}
      </button>

      {error && (
        <span style={{ fontSize: '12.5px', color: '#E0554E', lineHeight: 1.5 }}>{error}</span>
      )}

      {/* 복구하지 않고 그냥 나가는 길. 이 화면에는 하단 탭도 다른 링크도 없어서,
          이것이 없으면 탈퇴를 신청한 사람이 로그아웃조차 할 수 없다. */}
      <button
        onClick={() => void signOut({ callbackUrl: '/login' })}
        disabled={pending}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          cursor: pending ? 'default' : 'pointer',
          color: '#8FAAD0',
          padding: '6px',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        {t('common.signOut')}
      </button>
    </div>
  );
}
