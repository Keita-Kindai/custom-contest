import Link from "next/link";

import { AppShell } from "@/app/_components/app-shell";
import { JoinRoomForm } from "@/app/_components/join-room-form";

export default function JoinBattlePage() {
  return (
    <AppShell>
      <header className="page-head">
        <div>
          <p className="kicker">JOIN ROOM</p>
          <h1>友達のRoomへ参加</h1>
        </div>
        <p>招待URLを受け取った場合は入力不要です。Room IDしかない場合に、6桁を入力してください。</p>
      </header>
      <section className="section-block">
        <JoinRoomForm />
      </section>
      <div className="section-block">
        <Link className="button button-quiet" href="/battle/new">自分でRoomを作る</Link>
      </div>
    </AppShell>
  );
}
