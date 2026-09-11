/**
 * storage.ts 의 한도 · 규칙 검사. 프레임워크 없음.
 *   실행: node src/lib/storage.test.ts   (Node 22.18+ · 24 — .ts 를 그대로 읽는다)
 */
import assert from "node:assert/strict";
import {
  getAttendances,
  getMembers,
  getSchedule,
  getSchedules,
  getShareLink,
  saveAttendance,
  saveSchedule,
  saveShareLink,
  setMembers,
  todayString,
  validateSchedule,
} from "./storage.ts";

/* 브라우저 localStorage 흉내 — 같은 규칙(문자열만 저장) */
const store = new Map<string, string>();
const fake = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
const global = globalThis as unknown as { localStorage?: typeof fake };
global.localStorage = fake;

const 오늘 = todayString();
const 어제 = todayString(new Date(Date.now() - 24 * 60 * 60 * 1000));
const 내일 = todayString(new Date(Date.now() + 24 * 60 * 60 * 1000));

const 일정 = {
  title: "9월 정기 모임",
  date: 내일,
  time: "19:00",
  place: "스터디룸 B",
  status: "예정" as const,
  changed: false,
  createdAt: new Date().toISOString(),
};

function throws(fn: () => void, message: string) {
  assert.throws(fn, (e: Error) => e.message === message, `"${message}" 로 막혀야 한다`);
}

// 빈 저장소
assert.deepEqual(getSchedules(), [], "빈 저장소는 빈 배열");
assert.deepEqual(getAttendances(), []);
assert.equal(getShareLink("없는 일정"), undefined);

// 깨진 JSON
fake.setItem("team-schedule:schedules", "{이건 JSON 이 아니다");
assert.deepEqual(getSchedules(), [], "깨진 JSON 은 빈 배열");
fake.setItem("team-schedule:schedules", '{"title":"배열이 아님"}');
assert.deepEqual(getSchedules(), [], "배열이 아니면 빈 배열");
fake.clear();

// 일정 — 저장하고 다시 읽기
saveSchedule(일정);
assert.deepEqual(getSchedule("9월 정기 모임"), 일정);

// 일정 — 같은 제목은 덮어쓴다(F5 수정 · P4 변경됨)
saveSchedule({ ...일정, place: "동아리방", changed: true });
assert.equal(getSchedules().length, 1, "같은 제목이면 하나");
assert.equal(getSchedule("9월 정기 모임")?.place, "동아리방");
assert.equal(getSchedule("9월 정기 모임")?.changed, true);

// P3 — 제목 30자까지
throws(() => saveSchedule({ ...일정, title: "가".repeat(31) }), "제목은 30자까지입니다");
saveSchedule({ ...일정, title: "가".repeat(30) }); // 30자는 된다
assert.equal(getSchedules().length, 2);

// P3 — 네 칸은 비울 수 없다
for (const 빈칸 of [{ title: "" }, { date: "" }, { time: "" }, { place: " " }]) {
  throws(
    () => saveSchedule({ ...일정, ...빈칸 }),
    "제목 · 날짜 · 시간 · 장소는 비울 수 없습니다",
  );
}

// P3 — 날짜는 오늘 이후만 ("지난 날짜입니다")
throws(() => saveSchedule({ ...일정, date: 어제 }), "지난 날짜입니다");
assert.equal(validateSchedule({ ...일정, date: 오늘 }), null, "오늘은 된다");
assert.equal(validateSchedule({ ...일정, date: 내일 }), null);

// 상태값은 셋 중 하나
throws(
  () => saveSchedule({ ...일정, status: "취소됨" as never }),
  "상태값이 올바르지 않습니다",
);

// P5 — 한 사람은 일정 하나에 답 하나만, 다시 누르면 덮어쓴다
const 응답 = {
  name: "민수",
  schedule: "9월 정기 모임",
  answer: "참석" as const,
  answeredAt: new Date().toISOString(),
};
saveAttendance(응답);
saveAttendance({ ...응답, answer: "불참" });
assert.equal(getAttendances("9월 정기 모임").length, 1, "같은 이름은 하나");
assert.equal(getAttendances("9월 정기 모임")[0].answer, "불참", "칸만 옮겨 간다");

// 다른 사람 · 다른 일정은 따로 쌓인다
saveAttendance({ ...응답, name: "서연" });
saveAttendance({ ...응답, schedule: "10월 정기 모임" });
assert.equal(getAttendances("9월 정기 모임").length, 2);
assert.equal(getAttendances().length, 3);

// 참석/불참 둘 중 하나 · 이름은 비울 수 없다
throws(() => saveAttendance({ ...응답, answer: "미정" as never }), "참석 · 불참 중 하나여야 합니다");
throws(() => saveAttendance({ ...응답, name: "  " }), "이름을 입력하세요");

// 구성원 명단 — 이름 칸만
setMembers([{ name: "지우" }, { name: "민수" }, { name: "서연" }]);
assert.deepEqual(getMembers().map((m) => m.name), ["지우", "민수", "서연"]);
throws(() => setMembers([{ name: "" }]), "이름을 입력하세요");

// 공유 주소 — 한 일정에 하나, 새로고침 뒤에도 같다
saveShareLink({ schedule: "9월 정기 모임", url: "/s/abc" });
saveShareLink({ schedule: "9월 정기 모임", url: "/s/xyz" });
assert.equal(getShareLink("9월 정기 모임")?.url, "/s/xyz");
assert.equal(getShareLink("10월 정기 모임"), undefined);

// 서버 렌더 — localStorage 가 없어도 터지지 않는다
delete global.localStorage;
assert.deepEqual(getSchedules(), [], "서버에서는 빈 배열");
assert.equal(getShareLink("9월 정기 모임"), undefined);
saveSchedule(일정); // 아무것도 하지 않는다 — 예외 없음
global.localStorage = fake;
assert.equal(getSchedules().length, 2, "서버에서 쓴 것은 없다");

console.log("모든 검사 통과");
