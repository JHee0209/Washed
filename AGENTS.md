<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Rules

이 프로젝트에서 작업하는 에이전트는 코드 수정 전에 반드시 `CLAUDE.md`를 읽는다.

프로젝트별 코드 컨벤션, Git 작업 방식, 금지 사항, 검증 절차는 `CLAUDE.md`를 기준으로 한다.

반복 작업 절차는 `.claude/skills/` 아래의 Skill을 사용한다.

요구사항과 정책은 GitHub Issue 및 `docs/` 문서를 기준으로 하며,
문서에 없는 내용을 임의로 구현하지 않는다.