import { PracticeShellSkeleton } from "@/app/_practice/practice-shell";
import { PracticeBlocksSkeleton } from "@/app/_practice/components/skeletons";

export default function SignInLoading() {
  return (
    <PracticeShellSkeleton>
      <PracticeBlocksSkeleton blocks={1} label="ログイン状態を確認しています" />
    </PracticeShellSkeleton>
  );
}
