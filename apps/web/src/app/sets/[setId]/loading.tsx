import { PracticeShellSkeleton } from "@/app/_practice/practice-shell";
import { SetDetailSkeleton } from "@/app/_practice/components/skeletons";

export default function SetDetailLoading() {
  return (
    <PracticeShellSkeleton current="discover">
      <SetDetailSkeleton />
    </PracticeShellSkeleton>
  );
}
