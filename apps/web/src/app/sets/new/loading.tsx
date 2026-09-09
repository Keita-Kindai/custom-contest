import { PracticeShellSkeleton } from "@/app/_practice/practice-shell";
import { PracticeBlocksSkeleton } from "@/app/_practice/components/skeletons";

export default function NewSetLoading() {
  return (
    <PracticeShellSkeleton current="create">
      <PracticeBlocksSkeleton blocks={2} label="作成画面を読み込んでいます" />
    </PracticeShellSkeleton>
  );
}
