import { PracticeShellSkeleton } from "@/app/_practice/practice-shell";
import { PracticeBlocksSkeleton } from "@/app/_practice/components/skeletons";

export default function EditSetLoading() {
  return (
    <PracticeShellSkeleton current="create">
      <PracticeBlocksSkeleton blocks={2} label="問題セットを読み込んでいます" />
    </PracticeShellSkeleton>
  );
}
