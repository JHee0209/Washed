'use client';

import { signOut } from 'next-auth/react';

export default function SignOutButton() {
  return (
    <button
      onClick={() => void signOut({ callbackUrl: '/login' })}
      style={{
        width: '100%',
        height: 48,
        borderRadius: 14,
        border: '1.5px solid #E3EBF7',
        background: '#fff',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
        color: '#5A6E8F',
      }}
    >
      로그아웃
    </button>
  );
}
