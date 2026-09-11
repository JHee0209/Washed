import { Suspense } from "react";
import { Screen, ScreenHeader } from "@/components/screen";

export default function ScheduleFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <Screen>
          <ScreenHeader title="로딩 중..." onBack={undefined} />
        </Screen>
      }
    >
      {children}
    </Suspense>
  );
}
