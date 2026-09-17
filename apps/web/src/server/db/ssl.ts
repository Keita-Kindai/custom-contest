/**
 * DB接続文字列のTLS設定（ADR-0009）。
 *
 * アプリ本体（`client.ts`）とmigration・seed script（`scripts/`）の両方から使う。
 * script側はNodeのtype strippingで直接実行するため、workspaceのpackageも
 * drizzleもimportできない。この理由から、ここは依存を持たない単独fileにする。
 */

/**
 * `sslmode`を`verify-full`へ書き換える。
 *
 * Neonの接続文字列は`sslmode=require`で届く。いまの`pg`はこれを`verify-full`
 * （サーバー証明書とホスト名の両方を検証する）として扱うが、pg 9 /
 * pg-connection-string 3からはlibpqの意味になり、「暗号化はするが検証しない」へ弱まる。
 * その差し替えは中間者攻撃を許すので、いまの強さをこちらで固定しておく。
 *
 * 置き換えるのは`sslmode=`の値だけで、接続文字列の他の部分には触れない。
 * URLとして解析し直すと、passwordのpercent encodingが変わって接続できなくなる場合がある。
 * `sslmode`を持たない接続文字列（ローカルのPostgreSQL）はそのまま返す。
 */
export function pinSslMode(connectionString: string): string {
  return connectionString.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/i, "$1verify-full");
}

function pinned(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? pinSslMode(trimmed) : null;
}

/**
 * 実行時の接続文字列。未設定ならnull。
 *
 * 生の`process.env.DATABASE_URL`を直接`pg`へ渡してはいけない。migrationはDDL権限を持つ
 * 唯一の接続であり、そこだけ検証なしのTLSになると、アプリ本体より弱い経路ができる。
 */
export function databaseUrl(): string | null {
  return pinned(process.env.DATABASE_URL);
}

/**
 * migrationとseedが使う接続文字列。
 *
 * 本番ではDDLを持つロールと、アプリが使う実行時ロールを分ける。実行時ロールには
 * `CREATE`を与えないので、その接続文字列でmigrationを流すと失敗する。
 * `MIGRATION_DATABASE_URL`があればそちらを使い、無ければ`DATABASE_URL`へ落ちる。
 *
 * 落とすのは、ロールを分けていない環境（ローカル開発、CI、分離前の本番）を
 * そのまま動かし続けるためである。分離は環境変数を1つ足すだけで有効になり、
 * 足すまでは今までどおりに動く。
 */
export function migrationDatabaseUrl(): string | null {
  return pinned(process.env.MIGRATION_DATABASE_URL) ?? pinned(process.env.DATABASE_URL);
}
