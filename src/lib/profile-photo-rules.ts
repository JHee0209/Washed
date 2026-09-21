// 프로필 사진 업로드 규칙 (Issue #76).
//
// report-rules.ts 와 같은 이유로 존재한다 — 화면과 서버가 같은 조건을 보게
// 한다. 이 파일은 DB · server-only 를 import 하지 않아 클라이언트 컴포넌트
// (profile-client.tsx · settings-client.tsx)에서도 그대로 쓴다.

/**
 * 최대 용량. 신고 증거 사진(4MB · report-rules.ts)과 달리 프로필 아바타는
 * 화면에 작게만 표시되므로 더 작게 잡는다(사용자 확정).
 */
export const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

/** 사람이 읽는 한도 표기 — 화면 문구와 서버 오류 메시지가 함께 쓴다 */
export const MAX_PROFILE_PHOTO_LABEL = `${MAX_PROFILE_PHOTO_BYTES / (1024 * 1024)}MB`;

/**
 * 받아 주는 이미지 형식. SVG 는 포함하지 않는다(스크립트를 담을 수 있다).
 * db/migrations/0014 의 `profile_photos.mime_type` CHECK 도 같은 집합이다.
 */
export const ALLOWED_PROFILE_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ProfilePhotoMime = (typeof ALLOWED_PROFILE_PHOTO_MIME)[number];

export function isAllowedProfilePhotoMime(value: unknown): value is ProfilePhotoMime {
  return typeof value === 'string' && (ALLOWED_PROFILE_PHOTO_MIME as readonly string[]).includes(value);
}

/**
 * 실제 파일 바이트의 매직 넘버로 형식을 판정한다.
 *
 * report-rules.ts 의 기존 검증은 `File.type`(브라우저가 말한 MIME) 문자열만
 * 보는데, 그 값은 사용자가 얼마든지 조작해 보낼 수 있다. 프로필 사진은 여기서
 * **실제 바이트 서명**까지 확인해 그 허점을 막는다 — 확장자를 바꾸거나
 * Content-Type 을 조작해도 파일의 첫 몇 바이트는 바뀌지 않는다.
 */
export function detectImageMimeFromBytes(bytes: Uint8Array): ProfilePhotoMime | null {
  // JPEG — FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP — RIFF....WEBP 컨테이너(4~7바이트는 파일 크기라 검사하지 않는다)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export type ProfilePhotoValidationResult =
  | { ok: true; mime: ProfilePhotoMime }
  /** `status` 는 라우트가 그대로 HTTP 상태로 쓴다 (415 · 413 을 400 과 가른다) */
  | { ok: false; status: 400 | 413 | 415; message: string };

/**
 * 서버가 **실제로 읽은 바이트**를 기준으로 판정한다. `File.type`/Content-Type
 * 헤더는 여기서 아예 보지 않는다 — 매직 넘버가 허용 형식과 일치해야 통과한다.
 */
export function validateProfilePhotoBytes(bytes: Uint8Array): ProfilePhotoValidationResult {
  if (bytes.length === 0) {
    return { ok: false, status: 400, message: '사진 파일이 비어 있어요.' };
  }
  if (bytes.length > MAX_PROFILE_PHOTO_BYTES) {
    return { ok: false, status: 413, message: `사진은 ${MAX_PROFILE_PHOTO_LABEL} 까지 첨부할 수 있어요.` };
  }
  const detected = detectImageMimeFromBytes(bytes);
  if (!detected) {
    return { ok: false, status: 415, message: 'JPG · PNG · WebP 이미지만 첨부할 수 있어요.' };
  }
  return { ok: true, mime: detected };
}
