'use client';

// 프로필 사진 표시 (Issue #76).
//
// 사진이 없으면(GET /api/profile/photo 가 404) 두 화면(프로필 수정 · 설정)이
// 전부터 써 오던 고정 사람 실루엣 SVG 를 그대로 보여준다 — 새 기본 이미지를
// 만들지 않는다.
//
// <img> 를 그대로 쓴다 — 이 프로젝트는 이미 다른 곳(예: 로고)에서도 next/image
// 없이 <img> 를 쓰고 있고, 이 주소는 세션에 따라 매번 바뀌는 private API 라
// next/image 의 정적 최적화 대상이 아니다.

import { useState } from 'react';

type ProfileAvatarProps = {
  size: number;
  /** 저장 성공 직후 값을 바꿔 주면 캐시된 이전 사진 대신 새 사진을 다시 받아온다 */
  version?: number;
};

function PlaceholderIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="-7 -5.25 38 38" fill="#fff">
      <circle cx="12" cy="8.6" r="4.2"></circle>
      <path d="M3.5 22c0-5 3.8-8 8.5-8s8.5 3 8.5 8"></path>
    </svg>
  );
}

// version 이 바뀔 때(사진을 새로 저장했을 때) 이 컴포넌트를 통째로 다시
// 마운트시켜 hasPhoto 를 새로 true 부터 시작하게 한다(아래 key={version}) —
// 실패했던 상태가 남아 있으면 새로 올린 사진도 계속 안 보이게 된다. 이펙트
// 안에서 setState 로 되돌리는 대신 key 로 리마운트시키는 쪽이 더 단순하다.
function AvatarImage({ size, src }: { size: number; src: string }) {
  const [hasPhoto, setHasPhoto] = useState(true);

  if (!hasPhoto) return <PlaceholderIcon size={size} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setHasPhoto(false)}
    />
  );
}

export default function ProfileAvatar({ size, version }: ProfileAvatarProps) {
  const src = version ? `/api/profile/photo?v=${version}` : '/api/profile/photo';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#B7C6E0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <AvatarImage key={version ?? 0} size={size} src={src} />
    </div>
  );
}
