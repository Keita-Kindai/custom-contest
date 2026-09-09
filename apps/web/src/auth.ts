import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { getDb } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/auth-schema";

/**
 * 画面に出す名前を決める（ADR-0011）。
 * OAuthの表示名をそのまま写すが、providerによってはnullで返るため、その場合はIDから作る。
 */
function initialDisplayName(name: string | null | undefined, userId: string): string {
  const trimmed = name?.trim() ?? "";
  return trimmed ? trimmed.slice(0, 32) : `user_${userId.slice(0, 6)}`;
}

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
      if (!user) return session;
      session.user.id = user.id;
      // 画面に出すのは display_name。OAuthの表示名（users.name）は変更の初期値としてだけ使う。
      const displayName = (user as { displayName?: string | null }).displayName;
      if (displayName) session.user.name = displayName;
      return session;
    },
  },
  events: {
    /**
     * 初回ログインでusers行ができた直後に、画面に出す名前を埋める。
     * DrizzleAdapterはOAuthのprofileが持つ列しか書かないので、display_nameはここで入れる。
     */
    async createUser({ user }) {
      if (!db || !user.id) return;
      await db
        .update(users)
        .set({ displayName: initialDisplayName(user.name, user.id) })
        .where(eq(users.id, user.id));
    },
  },
});
