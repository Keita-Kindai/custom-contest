"use server";

import { signOut } from "@/auth";

/**
 * ログアウト。client componentのモーダルから呼ぶため、server actionを単独のファイルに置く。
 * `PracticeShell`の中に無名のserver actionを書くと、client側のモーダルへ渡せない。
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/discover" });
}
