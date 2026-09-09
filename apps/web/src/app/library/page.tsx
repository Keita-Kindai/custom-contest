import type { Metadata } from "next";

import { auth } from "@/auth";
import { LibraryView } from "@/app/_practice/library-view";
import { PracticeShell } from "@/app/_practice/practice-shell";

export const metadata: Metadata = {
  title: "マイページ — Custom Contest",
  description: "作成・ブックマーク・いいね・最近使用した問題セット。",
};

export default async function LibraryPage() {
  const session = await auth();
  return (
    <PracticeShell current="library">
      <LibraryView signedIn={Boolean(session?.user)} />
    </PracticeShell>
  );
}
