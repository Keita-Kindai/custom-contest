import { PracticeShellSkeleton } from "@/app/_practice/practice-shell";
import { PracticeBlocksSkeleton } from "@/app/_practice/components/skeletons";

export default function SettingsLoading() {
  return (
    <PracticeShellSkeleton>
      <PracticeBlocksSkeleton blocks={2} label="設定を読み込んでいます" />
    </PracticeShellSkeleton>
  );
}
