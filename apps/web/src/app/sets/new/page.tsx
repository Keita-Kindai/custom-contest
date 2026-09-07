import type { Metadata } from "next";

import { PracticeShell } from "@/app/_practice/practice-shell";
import { SetEditorView } from "@/app/_practice/set-editor-view";

export const metadata: Metadata = {
  title: "問題セットを作成 — Custom Contest",
  description: "AtCoder Problemsを検索して、問題を1問ずつ追加する。",
};

export default function NewSetPage() {
  return (
    <PracticeShell current="create">
      <SetEditorView />
    </PracticeShell>
  );
}
