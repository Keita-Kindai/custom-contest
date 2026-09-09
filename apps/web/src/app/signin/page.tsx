import Link from "next/link";

import { auth, availableProviders, signIn, signOut } from "@/auth";
import { AppShell } from "@/app/_components/app-shell";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await auth();
  const providers = availableProviders();

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <p className="kicker">ACCOUNT</p>
          <h1>{session?.user ? "ログイン中" : "ログイン"}</h1>
        </div>
        <p>
          パスワードは扱いません。GitHubまたはGoogleのアカウントでログインします。AtCoder
          IDは本人の自己申告として別に保存し、本人確認には使いません。
        </p>
      </header>

      <section className="section-block">
        {session?.user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/discover" });
            }}
          >
            <p>
              {session.user.name ?? session.user.email ?? "アカウント"} でログインしています。
            </p>
            <button className="button" type="submit">
              ログアウト
            </button>
          </form>
        ) : providers.length === 0 ? (
          <div className="section-note">
            <p>OAuthアプリがまだ登録されていないため、ログインできません。</p>
            <p>
              GitHubとGoogleでOAuthアプリを作り、`apps/web/.env.local`へ`AUTH_SECRET`、
              `AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`を
              設定すると、この画面にログインボタンが出ます。手順は`docs/decisions/0009-deployment-and-auth.md`にあります。
            </p>
          </div>
        ) : (
          <div className="hero-actions">
            {providers.map((provider) => (
              <form
                key={provider.id}
                action={async () => {
                  "use server";
                  await signIn(provider.id, { redirectTo: "/discover" });
                }}
              >
                <button className="button button-primary" type="submit">
                  {provider.label}
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <div className="section-block">
        <Link className="button button-quiet" href="/discover">
          Discoverへ戻る
        </Link>
      </div>
    </AppShell>
  );
}
