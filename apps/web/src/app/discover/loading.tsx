import { PracticeShellSkeleton } from "@/app/_practice/practice-shell";
import { DiscoverSkeleton } from "@/app/_practice/components/skeletons";

/** Next.jsがこの画面をSuspenseで包み、sessionの解決を待つあいだ出す。 */
export default function DiscoverLoading() {
  return (
    <PracticeShellSkeleton current="discover">
      <DiscoverSkeleton />
    </PracticeShellSkeleton>
  );
}
