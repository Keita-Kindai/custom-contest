import type { Metadata } from "next";

import { PracticeShell } from "@/app/_practice/practice-shell";
import { SetDetailView } from "@/app/_practice/set-detail-view";

// セットの中身は端末内保存のため、serverはタイトルを知らない。共通のtitleを出す。
export const metadata: Metadata = {
  title: "問題セット — Custom Contest",
  description: "AtCoderの過去問で作られた問題セット。",
  /*
   * 限定公開のセットは`set_id`の推測しにくさだけで守られている。検索結果へ載せると、
   * URLがどこかへ出た時点で誰でも辿れるようになる。
   * serverはここで公開範囲を知らないため、公開セットだけを選んで載せることができない。
   * 公開セットは`/discover`から辿れる。
   */
  robots: { index: false, follow: false },
};

export default async function SetDetailPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  return (
    <PracticeShell current="discover">
      <SetDetailView setId={setId} />
    </PracticeShell>
  );
}
