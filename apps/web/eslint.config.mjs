import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /*
       * 分割代入で1つのkeyを落とす書き方（`const { setId: _ignored, ...draft } = set`）を
       * 未使用変数として数えない。落とした値に用は無いというのが書き手の意図で、
       * 名前を付けずに落とす構文がJavaScriptに無いためこうなる。
       *
       * 有効なのはrestを伴う分割代入だけなので、本当に使われていない変数や引数は
       * これまでどおり報告される。
       */
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
