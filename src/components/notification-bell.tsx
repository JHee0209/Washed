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
        top: '60px',
        background: `url(${hasUnread ? '/icons/bell-active.svg' : '/icons/bell.svg'}) center / cover no-repeat`,
      }}
    ></Link>
  );
}
