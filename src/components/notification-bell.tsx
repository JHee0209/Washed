'use client';

import Link from 'next/link';
import { useUnreadCount } from '@/lib/use-unread-count';

/** 상단 바의 종 아이콘 — 안 읽은 알림 수만 클라이언트에서 센다 (F18). */
export default function NotificationBell() {
  const unreadCount = useUnreadCount();
  const hasUnread = unreadCount > 0;

  return (
    <Link
      href="/notifications"
      style={{
        boxSizing: 'border-box',
        width: '25px',
        height: '25px',
        borderRadius: '8px',
        position: 'absolute',
        right: '30px',
        // 예전에는 `top: 60px` 이었다 — 목업 상태바(약 62px) 아래에 맞춘 값이다.
        // 헤더 위 여백을 걷어내면서, 헤더 높이가 safe-area 에 따라 달라져도
        // 로고와 같은 높이에 오도록 가운데 정렬로 바꾼다.
        top: '50%',
        transform: 'translateY(-50%)',
        background: `url(${hasUnread ? '/icons/bell-active.svg' : '/icons/bell.svg'}) center / cover no-repeat`,
      }}
    ></Link>
  );
}
