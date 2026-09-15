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

/**
 * `DATABASE_URL`をTLS設定を固定したうえで返す。未設定ならnull。
 *
 * 生の`process.env.DATABASE_URL`を直接`pg`へ渡してはいけない。migrationはDDL権限を持つ
 * 唯一の接続であり、そこだけ検証なしのTLSになると、アプリ本体より弱い経路ができる。
 */
export function databaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  return value ? pinSslMode(value) : null;
}
