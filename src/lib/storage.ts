/**
 * 저장 항목 — docs/06-data.md 「저장 항목」 표의 4개 항목과 그 칸만 담는다.
 * 표에 없는 칸은 만들지 않는다. 한도 · 규칙(제목 30자 · 날짜는 오늘 이후 · 참석/불참 중 하나 ·
 * 같은 이름은 하나만)은 저장 전에 검사한다.
 *
 * 저장 위치는 브라우저 localStorage 다(이번 단계의 요청). PRD 5절은 "서버 데이터베이스"로 적혀 있고
 * 07 공통 인수 조건은 "다른 기기 · 다른 사람이 새로고침해도 같은 것"을 요구한다 — localStorage 로는
 * 그 조건을 만족할 수 없다(같은 브라우저 안에서만 남는다).
 */

export type ScheduleStatus = "예정" | "진행 중" | "지난 일정";
export type Answer = "참석" | "불참";

/** 일정 — 제목 · 날짜 · 시간 · 장소 · 상태값 · 변경됨 표시 · 만든 시각 */
export type Schedule = {
  /** 제목 (30자까지 · P3) */
  title: string;
  /** 날짜 (오늘 이후만 · P3) — YYYY-MM-DD */
  date: string;
  /** 시간 — HH:MM */
  time: string;
  /** 장소 */
  place: string;
  /** 상태값 (05 상태값) */
  status: ScheduleStatus;
  /** 변경됨 표시 (시작 전까지 · P4) */
  changed: boolean;
  /** 만든 시각 — ISO 문자열 */
  createdAt: string;
};

/** 참석 응답 — 이름 · 어느 일정 · 참석/불참 · 남긴 시각 */
export type Attendance = {
  /** 이름 */
  name: string;
  /** 어느 일정 — 06 의 예시 값이 제목("9월 정기 모임")이라 제목으로 가리킨다 */
  schedule: string;
  /** 참석/불참 (둘 중 하나 · P5 — 같은 이름은 하나만) */
  answer: Answer;
  /** 남긴 시각 — ISO 문자열 */
  answeredAt: string;
};

/** 구성원 명단 — 이름 · [?] 명단을 누가 · 어디서 만드나(06 에서 정하지 않았다) */
export type Member = {
  name: string;
};

/** 공유 주소 — 어느 일정 · 주소 문자열 */
export type ShareLink = {
  /** 어느 일정 — 제목 */
  schedule: string;
  /** 주소 문자열 */
  url: string;
};

const KEY = {
  schedules: "team-schedule:schedules",
  attendances: "team-schedule:attendances",
  members: "team-schedule:members",
  shareLinks: "team-schedule:share-links",
} as const;

/* ── localStorage 읽고 쓰기 ── */

/** 서버 렌더 · 저장소 없음 · 깨진 JSON · 배열이 아닌 값 → 빈 배열 */
function readList<T>(key: string): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** 서버 렌더에서는 아무것도 하지 않는다. 저장소가 꽉 차면 예외는 그대로 올린다(조용히 잃지 않게) */
function writeList<T>(key: string, list: T[]): void {
  if (!globalThis.localStorage) return;
  globalThis.localStorage.setItem(key, JSON.stringify(list));
}

/* ── 검사 ── */

/** 오늘 날짜를 YYYY-MM-DD 로 (기기의 시간대 기준) */
export function todayString(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const STATUSES: ScheduleStatus[] = ["예정", "진행 중", "지난 일정"];

/** 어기면 그 이유를, 괜찮으면 null. 문구는 05 정책의 "위반 시" 칸을 따른다 */
export function validateSchedule(schedule: Schedule, now: Date = new Date()): string | null {
  const { title, date, time, place, status } = schedule;
  // P3 — 제목 · 날짜 · 시간 · 장소는 비울 수 없다
  if (!title.trim() || !date.trim() || !time.trim() || !place.trim()) {
    return "제목 · 날짜 · 시간 · 장소는 비울 수 없습니다";
  }
  // P3 — 제목은 30자까지
  if (title.length > 30) return "제목은 30자까지입니다";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "날짜 형식이 올바르지 않습니다";
  if (!/^\d{2}:\d{2}$/.test(time)) return "시간 형식이 올바르지 않습니다";
  // P3 — 날짜는 오늘 이후만 (오늘은 된다 · 위반 문구는 "지난 날짜입니다")
  if (date < todayString(now)) return "지난 날짜입니다";
  if (!STATUSES.includes(status)) return "상태값이 올바르지 않습니다";
  return null;
}

/** 어기면 그 이유를, 괜찮으면 null */
export function validateAttendance(attendance: Attendance): string | null {
  if (!attendance.name.trim()) return "이름을 입력하세요";
  if (!attendance.schedule.trim()) return "어느 일정인지 없습니다";
  // P5 — 참석/불참 둘 중 하나
  if (attendance.answer !== "참석" && attendance.answer !== "불참") {
    return "참석 · 불참 중 하나여야 합니다";
  }
  return null;
}

function assertValid(reason: string | null): void {
  if (reason) throw new Error(reason);
}

/* ── 일정 ── */

export function getSchedules(): Schedule[] {
  return readList<Schedule>(KEY.schedules);
}

/** 같은 제목이면 덮어쓴다(F5 수정) · 없으면 새로 넣는다(F1 등록) */
export function saveSchedule(schedule: Schedule, now: Date = new Date()): void {
  assertValid(validateSchedule(schedule, now));
  const list = getSchedules();
  const index = list.findIndex((s) => s.title === schedule.title);
  if (index === -1) list.push(schedule);
  else list[index] = schedule;
  writeList(KEY.schedules, list);
}

export function getSchedule(title: string): Schedule | undefined {
  return getSchedules().find((s) => s.title === title);
}

/* ── 참석 응답 ── */

export function getAttendances(scheduleTitle?: string): Attendance[] {
  const list = readList<Attendance>(KEY.attendances);
  return scheduleTitle === undefined ? list : list.filter((a) => a.schedule === scheduleTitle);
}

/** P5 — 한 사람은 일정 하나에 답 하나만. 같은 이름으로 다시 누르면 덮어쓴다 */
export function saveAttendance(attendance: Attendance): void {
  assertValid(validateAttendance(attendance));
  const list = getAttendances();
  const index = list.findIndex(
    (a) => a.schedule === attendance.schedule && a.name === attendance.name,
  );
  if (index === -1) list.push(attendance);
  else list[index] = attendance;
  writeList(KEY.attendances, list);
}

/* ── 구성원 명단 ── */
/* [?] 명단을 누가 · 어디서 만드나 — 06 에서 정하지 않았다. 여기서는 읽고 쓰기만 둔다 */

export function getMembers(): Member[] {
  return readList<Member>(KEY.members);
}

export function setMembers(members: Member[]): void {
  for (const member of members) {
    if (!member.name.trim()) throw new Error("이름을 입력하세요");
  }
  writeList(KEY.members, members);
}

/* ── 공유 주소 ── */

export function getShareLink(scheduleTitle: string): ShareLink | undefined {
  return readList<ShareLink>(KEY.shareLinks).find((l) => l.schedule === scheduleTitle);
}

/** 한 일정에 주소 하나 — 새로고침 뒤에도 같아야 한다(06 근거) */
export function saveShareLink(link: ShareLink): void {
  if (!link.schedule.trim() || !link.url.trim()) throw new Error("어느 일정 · 주소가 비었습니다");
  const list = readList<ShareLink>(KEY.shareLinks);
  const index = list.findIndex((l) => l.schedule === link.schedule);
  if (index === -1) list.push(link);
  else list[index] = link;
  writeList(KEY.shareLinks, list);
}
