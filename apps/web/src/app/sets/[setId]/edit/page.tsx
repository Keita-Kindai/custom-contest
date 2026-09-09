import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PracticeShell } from "@/app/_practice/practice-shell";
import { SetEditorView } from "@/app/_practice/set-editor-view";

export const metadata: Metadata = {
  title: "問題セットを編集 — Custom Contest",
  description: "問題セットのタイトル・タグ・収録問題を編集する。",
};

export default async function EditSetPage({ params }: { params: Promise<{ setId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { setId } = await params;
  return (
    <PracticeShell current="create">
      <SetEditorView setId={setId} />
    </PracticeShell>
  );
}
