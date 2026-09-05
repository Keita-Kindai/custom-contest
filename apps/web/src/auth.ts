import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { getDb } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/auth-schema";

/**
 * 認証（ADR-0009）。
 *
 * パスワードは扱わない。GitHubとGoogleのOAuthだけを受け付け、sessionはDBに置く。
 * AtCoder IDは本人の自己申告であって身元ではないので、認証には一切使わない。
 *
 * OAuth clientの登録は人が行う必要がある。環境変数が揃っていないprovider は
 * 一覧から外し、`/signin`が「未設定」と表示できるようにしてある。
 */
function configuredProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    );
  }
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }
  return providers;
}

/** 画面が「どのproviderで入れるか」を出すための一覧。secretは渡さない。 */
export function availableProviders(): { id: "github" | "google"; label: string }[] {
  const list: { id: "github" | "google"; label: string }[] = [];
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    list.push({ id: "github", label: "GitHubで続ける" });
  }
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    list.push({ id: "google", label: "Googleで続ける" });
  }
  return list;
}

const db = getDb();

export const { handlers, auth, signIn, signOut } = NextAuth({
  // DBが未設定の環境（現在のデモ構成）では adapter を付けない。
  adapter: db
    ? DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
  session: { strategy: db ? "database" : "jwt" },
  providers: configuredProviders(),
  pages: { signIn: "/signin" },
  callbacks: {
    session({ session, user }) {
      if (user) session.user.id = user.id;
      return session;
    },
  },
});
