"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { IconButton } from "@/components/ui";

/**
 * 세 화면이 함께 쓰는 틀.
 * 원본: .dc.html 의 바깥 div(폰 폭 390px) 와 ScheduleForm/ScheduleDetail 의 header.
 * 원본은 height 도 844px 로 고정돼 있지만(디자인 캔버스), 브라우저에서는 화면 높이를 쓴다 — min-h-dvh.
 *
 * 안쪽 화면들은 localStorage 를 렌더 중에 읽는다 — 서버 렌더는 늘 빈 값이라 그대로 두면
 * hydration 이 어긋난다(React #418). 첫 클라이언트 렌더까지 속을 비워 서버 HTML 과 같게 맞춘 뒤 그린다.
 * ponytail: 첫 그림이 한 번 빈 화면이다. 저장이 서버로 옮겨가면(PRD 5절) 이 가드는 지운다.
 */
const subscribe = () => () => {};

export function Screen({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[var(--screen-width)] flex-col bg-bg text-text">
      {hydrated && children}
    </div>
  );
}

/** 머리 — 뒤로 가기 · 제목 · 오른쪽 동작 슬롯(예: Detail 의 "수정"). 이동은 onBack 을 받는 쪽이 정한다 */
export function ScreenHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-center gap-3">
        <IconButton aria-label="뒤로가기" onClick={onBack}>
          <ChevronLeftIcon />
        </IconButton>
        <h1 className="text-xl font-black">{title}</h1>
      </div>
      {action}
    </header>
  );
}
