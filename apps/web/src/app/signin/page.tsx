import type { Metadata } from "next";
import Link from "next/link";

import { auth, availableProviders, signIn, signOut } from "@/auth";
import { PracticeShell } from "@/app/_practice/practice-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ログイン — Custom Contest" };

export default async function SignInPage() {
  const session = await auth();
  const providers = availableProviders();

  return (
    <PracticeShell>
      <div className="practice-page">
        <div className="practice-page-head">
          <div>
            <h1>{session?.user ? "ログイン中" : "ログイン"}</h1>
            <p className="practice-lead">
              パスワードは扱いません。GitHubまたはGoogleのアカウントでログインします。
            </p>
          </div>
        </div>

        <section className="create-block">
          {session?.user ? (
            <>
              <p>{session.user.name ?? session.user.email ?? "アカウント"} でログインしています。</p>
              <div className="reaction-row">
                <Link className="practice-button" href="/settings">
                  名前を変える
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/discover" });
                  }}
                >
                  <button className="practice-button" type="submit">
                    ログアウト
                  </button>
                </form>
              </div>
            </>
          ) : providers.length === 0 ? (
            <>
              <h2>OAuthアプリが未設定です</h2>
              <p className="ps-field-help">
                GitHubとGoogleでOAuthアプリを作り、<code>apps/web/.env.local</code>へ
                <code>AUTH_SECRET</code>、<code>AUTH_GITHUB_ID</code>、
                <code>AUTH_GITHUB_SECRET</code>、<code>AUTH_GOOGLE_ID</code>、
                <code>AUTH_GOOGLE_SECRET</code>
                を設定すると、この画面にログインボタンが出ます。手順は
                <code>docs/decisions/0009-deployment-and-auth.md</code>にあります。
              </p>
            </>
          ) : (
            <>
              <div className="reaction-row">
                {providers.map((provider) => (
                  <form
                    key={provider.id}
                    action={async () => {
                      "use server";
                      await signIn(provider.id, { redirectTo: "/discover" });
                    }}
                  >
                    <button className="practice-button is-primary" type="submit">
                      {provider.label}
                    </button>
                  </form>
                ))}
              </div>
              <p className="ps-field-help">
                AtCoder IDは本人の自己申告として別に保存し、本人確認には使いません。
              </p>
            </>
          )}
        </section>
      </div>
    </PracticeShell>
  );
}
