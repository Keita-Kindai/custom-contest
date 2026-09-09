import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PracticeShell } from "@/app/_practice/practice-shell";
import { SetEditorView } from "@/app/_practice/set-editor-view";

export const metadata: Metadata = {
  title: "問題セットを作成 — Custom Contest",
  description: "AtCoder Problemsを検索して、問題を1問ずつ追加する。",
};

export default async function NewSetPage() {
  // 作成にはログインが要る（ADR-0011）。作り終えてから弾かれるより、入口で送る。
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PracticeShell current="create">
      <SetEditorView />
    </PracticeShell>
  );
}
