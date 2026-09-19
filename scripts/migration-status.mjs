// db/migrations/ 의 파일 목록과 DB 장부(schema_migrations)를 견주는 판정만 모아 둔다.
//
// **여기에는 I/O 가 없다.** DB 도 파일도 읽지 않고 인자만 받아 판정한다 — 그래서
// migration-status.test.mjs 가 DB 없이 이 로직을 그대로 검사할 수 있다.
// 실제 접속과 출력은 db-migrate-status.mjs 가 한다 (실행: npm run db:migrate:status).
//
// 비교 기준은 db-migrate.mjs 와 **같아야 한다** — 그 스크립트는 schema_migrations 에
// 파일 이름을 그대로 넣고 이름으로만 적용 여부를 가린다. 그래서 여기서도 비교 키는
// 번호가 아니라 **파일 이름 문자열**이다. 번호가 이어지는지는 보지 않는다 —
// 지금 0009 가 비어 있는 것(0010 머리말의 번호 메모 참고)만으로는 아무것도 보고하지 않는다.

/**
 * 종료 코드. CI 나 배포 전 검증에서 결과를 구분할 수 있게 값을 고정한다.
 *
 * 장부 전용(orphan)은 **경고일 뿐 실패가 아니다** — 아직 병합되지 않은 팀원 브랜치의
 * migration 이 그 DB 에 먼저 적용된 상태가 정상적인 협업 중에 생기기 때문이다.
 * 배포를 막아야 하는 것은 「코드에 있는데 DB 에 없는」 pending 쪽이다.
 */
export const EXIT = {
  OK: 0, // 정상 — 장부 전용 경고만 있는 경우도 여기다
  FAILED: 1, // 환경변수 없음 · DB 연결 실패
  PENDING: 2, // 적용되지 않은 migration 이 있다
  LEDGER_ERROR: 3, // schema_migrations 조회 실패 (권한 등)
};

/**
 * 파일 목록과 장부 기록을 견준다.
 *
 * @param {string[]} files            db/migrations/ 의 .sql 파일 이름 (정렬된 상태)
 * @param {string[]} appliedFilenames schema_migrations.filename 값
 * @returns {{ files: string[], applied: string[], pending: string[], orphans: string[] }}
 *   pending — 파일은 있는데 장부에 없다. 적용이 밀린 것이다
 *   orphans — 장부에는 있는데 파일이 없다. 다른 브랜치의 migration 일 수 있다
 */
export function compareMigrations(files, appliedFilenames) {
  const applied = new Set(appliedFilenames);
  const onDisk = new Set(files);

  return {
    files: [...files],
    // 장부는 들어온 순서를 믿지 않고 여기서 정렬한다 — 파일 쪽 순서와 나란히 읽으려고.
    applied: [...applied].sort(),
    pending: files.filter((f) => !applied.has(f)),
    orphans: [...applied].filter((f) => !onDisk.has(f)).sort(),
  };
}

/**
 * 비교 결과를 종료 코드로 옮긴다. 장부 전용은 exit 0 을 유지한다 (위 EXIT 주석).
 */
export function exitCodeFor({ pending }) {
  return pending.length ? EXIT.PENDING : EXIT.OK;
}

/**
 * 사람이 읽을 보고서를 만든다. 출력 줄의 배열을 돌려주고 찍지는 않는다 —
 * 테스트가 문자열로 확인할 수 있게, 그리고 **비밀값이 낄 자리가 없게** 하려는 것이다.
 * 이 함수는 접속 문자열을 인자로 받지 않는다.
 *
 * @param {ReturnType<typeof compareMigrations>} result
 * @param {{ envLabel: string, appliedAt?: Map<string, string>, ledgerMissing?: boolean }} options
 *   envLabel      — 어느 DB 를 봤는지 나타내는 안전한 딱지 (DB URL 이 아니다)
 *   appliedAt     — 파일 이름 → 적용 날짜 문자열 (없으면 날짜를 비운다)
 *   ledgerMissing — schema_migrations 표 자체가 없는 DB
 */
export function formatReport(result, { envLabel, appliedAt = new Map(), ledgerMissing = false }) {
  const { files, applied, pending, orphans } = result;
  const lines = ['', `migration 적용 상태 — ${envLabel}`, ''];

  if (ledgerMissing) {
    lines.push(
      '  schema_migrations 표가 없습니다 — 이 DB 에는 db:migrate 를 한 번도 돌리지 않았습니다.',
      '  db:push 로 세운 새 DB 라면 표·칸은 이미 있고 장부만 비어 있을 수 있습니다',
      '  (db/migrations/README.md 「어떻게 적용하나」 참고).',
      '',
    );
  }

  const width = Math.max(0, ...files.map((f) => f.length));
  for (const filename of files) {
    if (applied.includes(filename)) {
      const when = appliedAt.get(filename) ?? '';
      lines.push(`  적용됨  ${filename.padEnd(width)}  ${when}`.trimEnd());
    } else {
      lines.push(`  미적용  ${filename}`);
    }
  }

  lines.push('', `repository 파일 ${files.length}개 · 장부 기록 ${applied.length}개`);

  if (pending.length) {
    lines.push('', `[미적용] 아직 적용되지 않은 migration ${pending.length}개`);
    for (const filename of pending) lines.push(`  · ${filename}`);
    lines.push(
      '',
      '이 명령은 아무것도 바꾸지 않습니다. 적용은 사람이 환경을 확인한 뒤',
      'npm run db:migrate 로 직접 합니다.',
    );
  } else {
    lines.push('미적용 migration 없음.');
  }

  if (orphans.length) {
    lines.push('', `[경고] repository 에 파일이 없는데 장부에만 있는 기록 ${orphans.length}개`);
    for (const filename of orphans) lines.push(`  · ${filename}`);
    lines.push(
      '',
      '아직 병합되지 않은 팀원 브랜치의 migration 일 수 있습니다.',
      '그 번호로 파일을 새로 만들거나 이미 적용된 migration 의 번호를 바꾸지 마세요 —',
      '어느 브랜치의 것인지 사람이 확인합니다.',
    );
  }

  lines.push('');
  return lines;
}
