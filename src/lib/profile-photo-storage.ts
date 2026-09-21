// 프로필 사진의 **저장소 층** (Issue #76 · evidence-storage.ts 와 같은 패턴).
//
// 바깥(라우트)은 이 파일의 함수만 부른다. 지금은 Neon Postgres 안의
// profile_photos 표(0014)가 저장소지만, 나중에 외부 스토리지로 옮길 때
// 고칠 곳은 여기 하나다.
//
// 바이트를 base64 로 주고받는 이유는 evidence-storage.ts 머리말과 같다 —
// @neondatabase/serverless 의 HTTP 드라이버가 Buffer 를 그대로 직렬화하지
// 못해서다.

import 'server-only';

import { sql } from '@/lib/db';
import type { ProfilePhotoMime } from '@/lib/profile-photo-rules';

export type StoredProfilePhoto = {
  mimeType: ProfilePhotoMime;
  byteSize: number;
  bytes: Buffer;
};

/** 이 사용자의 프로필 사진을 읽는다. 없으면 null(기본 아이콘을 보여줄 자리) */
export async function readProfilePhoto(userId: string): Promise<StoredProfilePhoto | null> {
  const rows = await sql<{ mime_type: ProfilePhotoMime; byte_size: number; b64: string }>`
    SELECT mime_type, byte_size, encode(bytes, 'base64') AS b64
      FROM profile_photos
     WHERE user_id = ${userId}
     LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  return {
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    bytes: Buffer.from(row.b64, 'base64'),
  };
}

/**
 * 사진을 저장한다 — 있으면 교체, 없으면 새로 만든다.
 *
 * PK 가 user_id 하나뿐이라 `ON CONFLICT (user_id) DO UPDATE` 로 같은 행만
 * 갱신된다. 옛 사진이 별도 행으로 쌓이는 경로 자체가 없다(0014 머리말).
 */
export async function saveProfilePhoto(
  userId: string,
  mimeType: ProfilePhotoMime,
  bytes: Buffer,
): Promise<void> {
  await sql`
    INSERT INTO profile_photos (user_id, mime_type, byte_size, bytes, updated_at)
    VALUES (${userId}, ${mimeType}, ${bytes.byteLength}, decode(${bytes.toString('base64')}, 'base64'), now())
    ON CONFLICT (user_id) DO UPDATE
      SET mime_type  = EXCLUDED.mime_type,
          byte_size  = EXCLUDED.byte_size,
          bytes      = EXCLUDED.bytes,
          updated_at = now()
  `;
}

/**
 * 기본 이미지로 되돌린다 — 이 사용자의 행만 지운다 (Issue #84).
 *
 * PK 가 user_id 하나뿐이라 다른 사람의 행을 지울 수 있는 조건 자체가 없다.
 * 이미 사진이 없어도(0행) 에러가 아니다 — 호출부가 이 결과로 "지워진 게
 * 있었는지"를 알 수 있게 boolean 으로 돌려준다.
 */
export async function deleteProfilePhoto(userId: string): Promise<boolean> {
  const rows = await sql<{ user_id: string }>`
    DELETE FROM profile_photos
     WHERE user_id = ${userId}
    RETURNING user_id
  `;
  return rows.length > 0;
}
