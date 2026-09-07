import Link from "next/link";

import { AppShell } from "@/app/_components/app-shell";
import { CreateRoomForm } from "@/app/_components/create-room-form";

export default function NewBattlePage() {
  return (
    <AppShell>
      <header className="page-head">
        <div>
          <p className="kicker">CREATE ROOM</p>
          <h1>対戦条件を決める</h1>
        </div>
        <p>日曜デモでは選択肢を絞っています。問題は開始するまで両者へ送られません。</p>
      </header>
      <section className="section-block">
        <CreateRoomForm />
      </section>
      <div className="section-block">
        <Link className="button button-quiet" href="/">トップへ戻る</Link>
        <Link className="button button-quiet" href="/discover">問題セットを探す</Link>
      </div>
    </AppShell>
  );
}
