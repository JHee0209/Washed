"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { Field, PrimaryButton } from "@/components/ui";
import { getSchedule, saveSchedule, todayString } from "@/lib/storage";
import type { Schedule } from "@/lib/storage";

export default function ScheduleFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 모드 판정: title 쿼리 파라미터가 있으면 edit, 없으면 create
  const editTitle = searchParams.get("title");
  const isEditMode = !!editTitle;

  // 상태 초기화 함수 — edit 모드일 때만 기존 데이터 로드
  const [formData, setFormData] = useState(() => {
    if (isEditMode && editTitle) {
      const existing = getSchedule(editTitle);
      if (existing) {
        return {
          title: existing.title,
          date: existing.date,
          time: existing.time,
          place: existing.place,
        };
      }
    }
    return { title: "", date: "", time: "", place: "" };
  });

  const [dateError, setDateError] = useState(false);

  const { title, date, time, place } = formData;

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // 네 칸이 모두 찼는지 확인
  const isAllFilled = title.trim() && date.trim() && time.trim() && place.trim();

  // 날짜 검증 (오늘 이후만)
  const validateDate = (dateStr: string) => {
    if (!dateStr) return false;
    const today = todayString();
    return dateStr < today;
  };

  // 제출
  const handleSubmit = () => {
    // 지난 날짜 검사
    if (validateDate(date)) {
      setDateError(true);
      return;
    }
    setDateError(false);

    const schedule: Schedule = {
      title,
      date,
      time,
      place,
      status: "예정",
      changed: isEditMode, // F5: 수정 시 "변경됨" 표시 켜기
      createdAt: new Date().toISOString(),
    };

    try {
      saveSchedule(schedule);
      router.push(`/schedule-detail/${encodeURIComponent(title)}`);
    } catch (error) {
      console.error("일정 저장 실패:", error);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title={isEditMode ? "일정 수정" : "일정 등록"}
        onBack={() => router.back()}
      />

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-3 px-5 pb-6">
        {/* F1 · P3: 제목 입력, 30자까지, 글자수 카운터 */}
        <Field
          id="title"
          label="제목"
          type="text"
          maxLength={30}
          value={title}
          onChange={(e) => updateFormData({ title: e.target.value })}
          placeholder="예: 9월 정기 모임"
          count={`${title.length}/30자`}
        />

        {/* F1 · P3: 날짜 입력, 오늘 이후만, 지난 날짜 에러 */}
        <Field
          id="date"
          label="날짜"
          type="date"
          value={date}
          onChange={(e) => {
            updateFormData({ date: e.target.value });
            if (dateError && !validateDate(e.target.value)) {
              setDateError(false);
            }
          }}
          error={dateError ? "지난 날짜입니다" : undefined}
        />

        {/* F1 · P3: 시간 입력 */}
        <Field
          id="time"
          label="시간"
          type="time"
          value={time}
          onChange={(e) => updateFormData({ time: e.target.value })}
        />

        {/* F1 · P3: 장소 입력 */}
        <Field
          id="place"
          label="장소"
          type="text"
          value={place}
          onChange={(e) => updateFormData({ place: e.target.value })}
          placeholder="예: 스터디룸 B"
        />
      </div>

      {/* F1 · F5 · P3: 제출 버튼, 네 칸이 비어 있지 않을 때만 활성 */}
      <div className="flex shrink-0 gap-3 px-5 pb-6">
        <PrimaryButton
          disabled={!isAllFilled}
          onClick={handleSubmit}
        >
          {isEditMode ? "수정" : "등록"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
