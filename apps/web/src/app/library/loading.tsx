import { PracticeShellSkeleton } from "@/app/_practice/practice-shell";
import { LibrarySkeleton } from "@/app/_practice/components/skeletons";

export default function LibraryLoading() {
  return (
    <PracticeShellSkeleton current="library">
      <LibrarySkeleton />
    </PracticeShellSkeleton>
  );
}
