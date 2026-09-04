import type { Metadata } from "next";

import { LibraryView } from "@/app/_practice/library-view";
import { PracticeShell } from "@/app/_practice/practice-shell";

export const metadata: Metadata = {
  title: "マイページ — Custom Contest",
  description: "作成・ブックマーク・いいね・最近使用した問題セット。",
};

export default function LibraryPage() {
  return (
    <PracticeShell current="library">
      <LibraryView />
    </PracticeShell>
  );
}
