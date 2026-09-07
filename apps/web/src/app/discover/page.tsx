import type { Metadata } from "next";

import { DiscoverView } from "@/app/_practice/discover-view";
import { PracticeShell } from "@/app/_practice/practice-shell";

export const metadata: Metadata = {
  title: "Discover — Custom Contest",
  description: "AtCoderの過去問から作られた問題セットを探す。",
};

export default function DiscoverPage() {
  return (
    <PracticeShell current="discover">
      <DiscoverView />
    </PracticeShell>
  );
}
