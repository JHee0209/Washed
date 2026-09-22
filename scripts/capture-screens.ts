// 발표용 화면 캡처 (Playwright).
//
//   node --env-file=.env.local scripts/capture-screens.ts
//   node scripts/capture-screens.ts --only=admin-users,lang-en
//
// 기존 테스트(`npm test`)와는 무관한 **독립 도구**다 — test/ 아래 하네스나
// src/**/*.test.ts 를 건드리지 않는다.
//
// ── 로그인 세션
// 한 번만 로그인하고 storageState(쿠키 + localStorage)를 저장해 모든 화면에서 재사용한다.
// 계정은 환경변수로 받는다 — 자격증명을 소스에 적지 않는다(CLAUDE.md 「하드코딩 테스트 계정 금지」).
//
//   CAPTURE_EMAIL=... CAPTURE_PASSWORD=... node scripts/capture-screens.ts
//
// ── 캡처 기준
// viewport 기준(fullPage: false) · networkidle 대기 · 애니메이션 정지 · dev 표시기 제거.

import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdir, stat, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = process.env.CAPTURE_BASE_URL ?? 'https://washed-eulji.vercel.app';
// 값은 환경변수로만 받는다 — 소스·로그·스크린샷 어디에도 남기지 않는다.
const EMAIL = process.env.CAPTURE_USER_EMAIL ?? process.env.CAPTURE_EMAIL ?? '';
const PASSWORD = process.env.CAPTURE_USER_PW ?? process.env.CAPTURE_PASSWORD ?? '';

// 관리자 화면은 **수동 캡처본을 쓴다** — 자동 로그인을 다시 시도하지 않는다.
// docs/images/screens/admin-*.png 7개가 최종본이며 이 스크립트는 건드리지 않는다.
const ADMIN_ID = '';
const ADMIN_PW = '';

const OUT_DIR = path.resolve('docs/images/screens');

// 세션 파일에는 로그인 쿠키가 들어간다. 저장소 안에 두면 실수로 커밋될 수 있어
// **OS 임시 디렉터리**에 둔다 (CLAUDE.md 「credential 을 commit 하지 않는다」).
const STATE_DIR = path.join(tmpdir(), 'washed-capture');
const STATE_USER = path.join(STATE_DIR, 'state-user.json');
const STATE_ADMIN = path.join(STATE_DIR, 'state-admin.json');

const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1194 };
const DESKTOP = { width: 1440, height: 900 };

/** --only=a,b 로 일부만 다시 찍을 수 있다 */
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim())) : null;
const wanted = (name: string) => !ONLY || ONLY.has(name);

/** 캡처를 방해하는 것만 죽인다 — 페이지 로직은 건드리지 않는다 */
const CLEAN_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important; animation-delay: 0s !important;
    transition-duration: 0s !important; transition-delay: 0s !important;
  }
  nextjs-portal, [data-nextjs-dev-tools-button], nextjs-dev-tools-indicator { display: none !important; }
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
  html, body { scrollbar-width: none !important; }
`;

async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.addStyleTag({ content: CLEAN_CSS }).catch(() => {});
  // 알림 권한 안내 모달 등 첫 진입 오버레이를 닫는다 (있을 때만)
  for (const label of ['나중에', '닫기']) {
    const btn = page.getByRole('button', { name: label });
    if (await btn.count().then((n) => n > 0).catch(() => false)) {
      await btn.first().click({ timeout: 2000 }).catch(() => {});
    }
  }
  await page.waitForTimeout(600);
}

async function shoot(page: Page, name: string) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const { size } = await stat(file);
  console.log(`  ✅ ${name}.png  ${(size / 1024).toFixed(1)} KB`);
}

/** 화면이 비어 있지 않은지 확인한다 — 빈 상태로 찍히면 발표에 못 쓴다 */
async function expectContent(page: Page, name: string, needle: string | RegExp) {
  const body = (await page.locator('body').innerText().catch(() => '')) ?? '';
  const ok = typeof needle === 'string' ? body.includes(needle) : needle.test(body);
  if (!ok) console.warn(`  ⚠ ${name}: 기대한 내용("${needle}")을 찾지 못했습니다 — 빈 상태일 수 있습니다.`);
  return ok;
}

async function exists(p: string) {
  try { await access(p); return true; } catch { return false; }
}

// ── 로그인 (한 번만) ─────────────────────────────────────────────────────────

async function loginUser(browser: Browser) {
  if (await exists(STATE_USER)) {
    const raw = JSON.parse(await readFile(STATE_USER, 'utf8'));
    if (raw?.cookies?.length) return; // 이미 세션이 있다
  }
  if (!EMAIL || !PASSWORD) throw new Error('CAPTURE_EMAIL / CAPTURE_PASSWORD 환경변수가 필요합니다.');
  const ctx = await browser.newContext({ viewport: MOBILE });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('input').first().fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('**/home', { timeout: 20000 });
  await ctx.storageState({ path: STATE_USER });
  await ctx.close();
  console.log('사용자 로그인 세션 저장 완료');
}

async function loginAdmin(browser: Browser) {
  if (!ADMIN_ID || !ADMIN_PW) return false;
  if (await exists(STATE_ADMIN)) {
    const raw = JSON.parse(await readFile(STATE_ADMIN, 'utf8'));
    if (raw?.cookies?.length) return true;
  }
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/login`);
  await page.locator('input').first().fill(ADMIN_ID);
  await page.locator('input[type="password"]').fill(ADMIN_PW);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL('**/admin**', { timeout: 20000 }).catch(() => {});
  if (page.url().includes('/admin/login')) { await ctx.close(); return false; }
  await ctx.storageState({ path: STATE_ADMIN });
  await ctx.close();
  console.log('관리자 로그인 세션 저장 완료');
  return true;
}

// ── 화면별 캡처 ──────────────────────────────────────────────────────────────

async function captureLogin(browser: Browser) {
  if (!wanted('login')) return;
  const ctx = await browser.newContext({ viewport: MOBILE });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await settle(page);
  await shoot(page, 'login');
  await ctx.close();
}

async function userContext(browser: Browser, viewport: { width: number; height: number }) {
  return browser.newContext({ viewport, storageState: STATE_USER });
}

async function captureUserScreens(browser: Browser) {
  const ctx = await userContext(browser, MOBILE);
  const page = await ctx.newPage();

  if (wanted('home') || wanted('home-empty')) {
    await page.goto(`${BASE}/home`);
    await settle(page);
    const idle = await page.locator('body').innerText().then((t) => t.includes('아무것도 사용하지 않고'));
    if (wanted('home-empty') && idle) await shoot(page, 'home-empty');
    if (wanted('home')) {
      await expectContent(page, 'home', '실시간 대기 현황');
      await shoot(page, 'home');
    }
  }

  if (wanted('notifications')) {
    await page.goto(`${BASE}/notifications`);
    await settle(page);
    await expectContent(page, 'notifications', /알림|읽음/);
    await shoot(page, 'notifications');
  }

  if (wanted('records')) {
    await page.goto(`${BASE}/history`);
    await settle(page);
    await expectContent(page, 'records', /기록|이용/);
    await shoot(page, 'records');
  }

  if (wanted('settings')) {
    await page.goto(`${BASE}/settings`);
    await settle(page);
    await expectContent(page, 'settings', /알림|설정/);
    await shoot(page, 'settings');
  }

  await ctx.close();
}

async function captureResponsive(browser: Browser) {
  const sizes: Array<[string, { width: number; height: number }]> = [
    ['responsive-mobile', MOBILE], ['responsive-tablet', TABLET], ['responsive-desktop', DESKTOP],
  ];
  for (const [name, viewport] of sizes) {
    if (!wanted(name)) continue;
    const ctx = await userContext(browser, viewport);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/home`);
    await settle(page);
    await shoot(page, name);
    await ctx.close();
  }
}

/** 화면 라벨 → localStorage(washed_lang) 에 저장되는 코드 */
function langCode(label: string): string {
  return { '한국어': 'ko', 'English': 'en', '中文': 'zh', '日本語': 'ja' }[label] ?? 'ko';
}

/** 설정에서 언어를 바꾼 뒤 홈을 찍는다 (#13) */
async function captureLanguages(browser: Browser) {
  const langs: Array<[string, string]> = [
    ['lang-ko', '한국어'], ['lang-en', 'English'], ['lang-zh', '中文'], ['lang-ja', '日本語'],
  ];
  for (const [name, label] of langs) {
    if (!wanted(name)) continue;
    const ctx = await userContext(browser, MOBILE);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/settings`);
    await settle(page);
    // 「언어 설정」 행을 눌러 모달을 열고 해당 언어를 고른다.
    // 그룹 헤더인 「언어」(.ghead)가 아니라 .ctitle 행이어야 클릭이 먹는다.
    await page.locator('.ctitle', { hasText: '언어 설정' }).first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.getByText(label, { exact: true }).last().click({ timeout: 5000 });
    // 선택이 localStorage(washed_lang)에 저장될 때까지 기다린다
    await page.waitForFunction(
      (code) => localStorage.getItem('washed_lang') === code,
      langCode(label),
      { timeout: 5000 },
    ).catch(() => console.warn(`  ⚠ ${name}: 언어 저장을 확인하지 못했습니다.`));
    await page.goto(`${BASE}/home`);
    await settle(page);
    await shoot(page, name);
    await ctx.close();
  }
}

/** 관리자 탭들 — 탭은 ?tab= 쿼리로 고른다 */
async function captureAdmin(browser: Browser, ok: boolean) {
  const tabs: Array<[string, string, string | RegExp]> = [
    ['admin-devices', 'machines', /기기/],
    ['admin-queue', 'queue', /대기/],
    ['admin-reports', 'reports', /신고/],
    ['admin-warnings', 'warnings', /경고/],
    ['admin-notices', 'notices', /공지/],
    ['admin-users', 'users', /사용자|검색/],
    ['admin-inquiries', 'support', /문의/],
  ];
  if (!ok) {
    console.log('관리자 화면 7개는 수동 캡처본(docs/images/screens/admin-*.png)을 사용합니다 — 자동 캡처하지 않습니다.');
    return;
  }
  const ctx = await browser.newContext({ viewport: DESKTOP, storageState: STATE_ADMIN });
  const page = await ctx.newPage();
  for (const [name, tab, needle] of tabs) {
    if (!wanted(name)) continue;
    await page.goto(`${BASE}/admin?tab=${tab}`);
    await settle(page);
    await expectContent(page, name, needle);
    await shoot(page, name);
  }
  await ctx.close();
}

// ── 실행 ─────────────────────────────────────────────────────────────────────

const browser = await chromium.launch();
await mkdir(OUT_DIR, { recursive: true });
await mkdir(STATE_DIR, { recursive: true });
console.log(`대상: ${BASE}`);
console.log(`저장: ${OUT_DIR}\n`);

try {
  await captureLogin(browser);
  await loginUser(browser);
  const adminOk = await loginAdmin(browser);
  await captureUserScreens(browser);
  await captureResponsive(browser);
  await captureLanguages(browser);
  await captureAdmin(browser, adminOk);
} finally {
  await browser.close();
}

console.log('\n완료.');
