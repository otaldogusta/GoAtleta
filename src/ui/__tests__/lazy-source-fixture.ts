import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { transformSync } from "@babel/core";

/** Run the actual source with only the asynchronous module-loader boundary injected.
 * Jest's Expo preset leaves native import() unsupported in its default VM. This
 * does not model Metro splitting; the real build/browser must verify that too.
 */
export function loadLazySource<T>(filename: string, loadChunk: (name: string) => Promise<unknown>, requireModule: (name: string) => unknown): T {
  const absolute = path.resolve(filename);
  const transformed = transformSync(readFileSync(absolute, "utf8"), {
    filename: absolute, configFile: false, babelrc: false,
    presets: [["@babel/preset-typescript", { allExtensions: true, isTSX: true }]],
    plugins: [({ types }: any) => ({ visitor: { CallExpression(node: any) {
      if (node.node.callee.type === "Import") node.replaceWith(types.callExpression(types.identifier("__loadChunk"), node.node.arguments));
    } } }), ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }], "@babel/plugin-transform-modules-commonjs"],
  });
  if (!transformed?.code) throw new Error(`Unable to compile source fixture ${filename}`);
  const module = { exports: {} };
  vm.runInNewContext(transformed.code, {
    module, exports: module.exports, require: requireModule, __loadChunk: loadChunk,
    Promise, Date, URLSearchParams, AbortController, AbortSignal, setTimeout, clearTimeout, setInterval, clearInterval,
    window: typeof window === "undefined" ? undefined : window,
    document: typeof document === "undefined" ? undefined : document,
    sessionStorage: typeof sessionStorage === "undefined" ? undefined : sessionStorage,
  }, { filename: absolute });
  return module.exports as T;
}
