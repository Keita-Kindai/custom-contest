import { errorResponse } from "@/server/http";

/**
 * このデプロイが公開している機能の境界（ADR-0010）。
 *
 * 最初の公開範囲は精進（Discover・問題セット・ライブラリ）だけで、AC Duelは後回しにする。
 * `next.config.ts`の`redirects()`は`/battle/*`の画面しか転送しない。`/api/*`はそのまま残るので、
 * 画面を隠しただけでは対戦APIを閉じたことにならない。
 *
 * ここを通していない対戦系のroute handlerは、公開を止めていないのと同じ。
 * middlewareではなくhandlerの先頭で確かめるのは、header操作でmiddlewareを飛ばす種類の
 * 攻撃を前提にしても境界が残るようにするため。
 */

/**
 * Vercelの本番デプロイかどうか。
 *
 * `VERCEL_ENV`はVercelが入れる値で、このリポジトリの環境変数では上書きできない。
 * 「本番かどうか」の判定をアプリ側の設定に委ねると、設定ミスで本番が開く。
 * `NODE_ENV`は`next start`でも`production`になるため、ここでは使えない。
 */
function isDeployedProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/**
 * 対戦（Room・Match・userscript）をこのデプロイが公開しているか。
 *
 * 既定は「本番相当なら閉じる」。開発とtestでは開けておく。
 * 戻すときはVercel側で`CUSTOM_CONTEST_ENABLE_BATTLE=1`を入れる。ただし戻す前に、
 * Roomの外部状態ストア、本人確認と判定の信頼境界、濫用対策を設計し直すこと。
 * 現在のRoomはprocess内のMapなので、instanceが複数になると対戦がそもそも成立しない。
 */
export function battleEnabled(): boolean {
  if (process.env.CUSTOM_CONTEST_ENABLE_BATTLE === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Fake判定を受け付けるか。
 *
 * 本番デプロイでは環境変数に何が入っていても無効にする。ここが有効な本番は、
 * 誰でもACを名乗れる本番と同じ意味になる。設定ミス1つでそうなる余地を残さない。
 * Previewでは`CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE=1`で開けられる。隔離した環境での
 * 動作確認に要るため。
 */
export function fakeEvidenceEnabled(): boolean {
  if (isDeployedProduction()) return false;
  return process.env.NODE_ENV === "test" || process.env.CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE === "1";
}

/**
 * 対戦系のroute handlerの入口。公開していなければ404相当の応答を返す。
 * 呼び出し側は戻り値がnullのときだけ処理を続ける。
 */
export function requireBattleEnabled(): Response | null {
  if (battleEnabled()) return null;
  return errorResponse(
    "feature_disabled",
    "この機能は公開していません。",
    "現在は問題セットの作成と共有のみを公開しています。",
    404,
  );
}
