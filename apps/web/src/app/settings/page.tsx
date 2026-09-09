import { displayNameSchema } from "@custom-contest/contracts";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PracticeShell } from "@/app/_practice/practice-shell";
import { users } from "@/server/db/auth-schema";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "設定 — Custom Contest" };

/**
 * 画面に出す名前を変える（ADR-0011）。
 *
 * `users.name`はOAuthから受け取った値なので触らない。次にログインし直したとき、
 * Auth.jsがproviderの値で上書きする。利用者が決めた名前は`display_name`に置く。
 */
async function updateDisplayName(formData: FormData): Promise<void> {
  "use server";

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const db = getDb();
  if (!db) redirect("/settings?error=db");

  const parsed = displayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) redirect("/settings?error=name");

  await db.update(users).set({ displayName: parsed.data }).where(eq(users.id, session.user.id));
  redirect("/settings?saved=1");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const params = await searchParams;
  const notice =
    params.error === "name"
      ? "名前は1文字以上32文字以下で入力してください。"
      : params.error === "db"
        ? "データベースに接続できませんでした。"
        : params.saved
          ? "保存しました。"
          : null;

  return (
    <PracticeShell>
      <div className="practice-page">
        <div className="practice-page-head">
          <div>
            <h1>設定</h1>
            <p className="practice-lead">問題セットの作成者として表示される名前を変えられます。</p>
          </div>
        </div>

        {notice && <p className="practice-notice">{notice}</p>}

        <section className="create-block">
          <form action={updateDisplayName}>
            <label className="ps-field-label" htmlFor="display-name">
              表示する名前
            </label>
            <input
              className="practice-input"
              id="display-name"
              name="displayName"
              defaultValue={session.user.name ?? ""}
              maxLength={32}
              required
            />
            <p className="ps-field-help">
              作成した問題セットのカードに出ます。AtCoder IDを入れてもかまいませんが、
              本人確認には使いません。
            </p>
            <div className="reaction-row">
              <button className="practice-button is-primary" type="submit">
                保存する
              </button>
            </div>
          </form>
        </section>

        <section className="create-block">
          <h2>ログイン方法</h2>
          <p className="ps-field-help">
            {session.user.email ?? "メールアドレスの登録がありません"} でログインしています。
            パスワードは保存していません。
          </p>
          <div className="reaction-row">
            <Link className="practice-button" href="/signin">
              ログイン状態を確認する
            </Link>
          </div>
        </section>
      </div>
    </PracticeShell>
  );
}
