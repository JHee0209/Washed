// F20 — 프로필 사진 저장/조회/삭제 (Issue #76 · DELETE 는 Issue #84).
//
// POST   multipart/form-data { photo: File } → { ok: true }
// GET                                        → 사진 바이트 (없으면 404)
// DELETE                                     → 기본 이미지로 되돌림 (없어도 { ok: true })
//
// **대상은 항상 현재 로그인한 session.user.id 뿐이다.** 클라이언트가 다른
// user_id 를 query/body 로 보내 남의 사진을 보거나 바꿀 수 있는 자리를
// 만들지 않는다 — /api/reports/[id]/evidence 와 달리 아예 파라미터 자체가 없다.

import { auth } from '@/auth';
import { withdrawPendingBlock } from '@/lib/account-guard';
import { MAX_PROFILE_PHOTO_BYTES, validateProfilePhotoBytes } from '@/lib/profile-photo-rules';
import { deleteProfilePhoto, readProfilePhoto, saveProfilePhoto } from '@/lib/profile-photo-storage';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, code: 'LOGIN_REQUIRED', message: '로그인이 필요해요.' }, { status: 401 });
  }

  const photo = await readProfilePhoto(userId);
  if (!photo) {
    return Response.json({ ok: false, code: 'PHOTO_NOT_FOUND', message: '등록된 프로필 사진이 없어요.' }, { status: 404 });
  }

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      'Content-Type': photo.mimeType,
      'Content-Length': String(photo.byteSize),
      // 세션을 보고 내려주는 응답이다. 공용 캐시에 남을 이유가 없다.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, code: 'LOGIN_REQUIRED', message: '로그인이 필요해요.' }, { status: 401 });
  }

  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, code: 'BAD_REQUEST', message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const field = form.get('photo');
  const file = field instanceof File && field.size > 0 ? field : null;
  if (!file) {
    return Response.json({ ok: false, code: 'PHOTO_REQUIRED', message: '사진을 선택해주세요.' }, { status: 400 });
  }

  // 다 읽기 전에 한 번 본다 — 한도를 넘는 파일을 헛되이 메모리에 올리지 않는다.
  // file.size 는 브라우저가 말한 값이라 이것만 믿지 않고, 읽은 뒤 실제 바이트
  // 수로 다시 본다(아래 validateProfilePhotoBytes).
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return Response.json(
      { ok: false, message: `사진은 ${MAX_PROFILE_PHOTO_BYTES / (1024 * 1024)}MB 까지 첨부할 수 있어요.` },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // 형식은 file.type(Content-Type)이 아니라 실제 바이트 매직 넘버로 판정한다 —
  // 확장자나 Content-Type 을 조작해도 이 검사는 통과하지 못한다.
  const result = validateProfilePhotoBytes(bytes);
  if (!result.ok) {
    // 검증 결과의 code · params 를 그대로 흘려보낸다 — message 도 그대로 남는다 (Issue #13)
    return Response.json(
      { ok: false, code: result.code, params: result.params, message: result.message },
      { status: result.status },
    );
  }

  await saveProfilePhoto(userId, result.mime, bytes);

  return Response.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, code: 'LOGIN_REQUIRED', message: '로그인이 필요해요.' }, { status: 401 });
  }

  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  // 이미 사진이 없어도(0행 삭제) 오류가 아니다 — "기본 이미지로 되돌리기"는
  // 몇 번을 눌러도 같은 결과(기본 이미지)로 수렴해야 한다.
  await deleteProfilePhoto(userId);

  return Response.json({ ok: true });
}
