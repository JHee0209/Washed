'use server';

import { redirect } from 'next/navigation';

import { adminSignIn, adminSignOut } from '@/lib/admin-session';

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const loginId = String(formData.get('loginId') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!loginId.trim() || !password) return '아이디와 비밀번호를 입력해주세요.';

  // 어느 쪽이 틀렸는지 알려주지 않는다 — 관리자 아이디를 찾는 단서가 된다
  const ok = await adminSignIn(loginId, password);
  if (!ok) return '아이디 또는 비밀번호가 올바르지 않아요.';

  redirect('/admin');
}

export async function logoutAction() {
  await adminSignOut();
  redirect('/admin/login');
}
