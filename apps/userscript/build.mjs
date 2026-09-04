import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectDir = dirname(fileURLToPath(import.meta.url));
const serverOrigin = new URL(process.env.CUSTOM_CONTEST_SERVER_ORIGIN ?? "http://localhost:3000");
if (!/^https?:$/.test(serverOrigin.protocol) || serverOrigin.pathname !== "/") {
  throw new Error("CUSTOM_CONTEST_SERVER_ORIGIN must be an http(s) origin without a path");
}

const outfile = resolve(projectDir, "dist/custom-contest-atcoder.user.js");
await mkdir(dirname(outfile), { recursive: true });

const banner = `// ==UserScript==
// @name         Custom Contest AtCoder Bridge
// @namespace    https://github.com/Keita-Kindai/custom-contest
// @version      0.1.2-demo
// @description  Send this participant's AtCoder verdict evidence to a paired Custom Contest room.
// @match        https://atcoder.jp/
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      ${serverOrigin.hostname}
// @run-at       document-idle
// ==/UserScript==`;

await build({
  entryPoints: [resolve(projectDir, "src/index.ts")],
  outfile,
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: false,
  legalComments: "inline",
  banner: { js: banner },
  define: { __SERVER_ORIGIN__: JSON.stringify(serverOrigin.origin) },
});

console.log(`built ${outfile} for ${serverOrigin.origin}`);
