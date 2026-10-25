import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { URL } from "node:url";
import vm from "node:vm";
import { parse } from "@babel/parser";

import { navigateToDetailRoute } from "../primary-route-navigation";
import { withWebStackHistory } from "../web-stack-history";


// Evaluate unmodified installed SDK functions, not a model of its reducers or
// linking decisions. Only browser APIs and URL serialization are fixture bounds.
const sdkRequire = createRequire(path.join(process.cwd(), "package.json"));
const build = path.join(process.cwd(), "node_modules/expo-router/build");
export const sdkBase = sdkRequire(path.join(build, "react-navigation/routers/StackRouter.js"));
const sdkParams = sdkRequire(path.join(build, "navigationParams.js"));
export const sdkParser = sdkRequire(path.join(build, "react-navigation/core/getStateFromPath.js"));
export const sdkFocused = sdkRequire(path.join(build, "react-navigation/core/findFocusedRoute.js"));
const sdkRandom = sdkRequire("nanoid/non-secure");
export const sdkConstants = sdkRequire(path.join(build, "constants.js"));
const sdkRoutes = sdkRequire(path.join(build, "getRoutes.js"));
const sdkSerializer = sdkRequire(path.join(build, "react-navigation/core/getPathFromState.js"));
const sdkTab = sdkRequire(path.join(build, "react-navigation/routers/TabRouter.js"));
const sdkActions = sdkRequire(path.join(build, "react-navigation/core/getActionFromState.js"));
const sdkConfig = sdkRequire(path.join(build, "getReactNavigationConfig.js"));

export function extract(relative: string, names: string[], listen = false) {
  const filename = path.join(build, relative), source = readFileSync(filename, "utf8");
  const ast = parse(source, { sourceType: "unambiguous" });
  const found = new Map<string, string>();
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "FunctionDeclaration" && names.includes(node.id?.name)) found.set(node.id.name, source.slice(node.start, node.end));
    if (node.type === "VariableDeclarator" && names.includes(node.id?.name)) found.set(node.id.name, `const ${node.id.name} = ${source.slice(node.init.start, node.init.end)};`);
    if (listen && node.type === "CallExpression" && node.callee?.type === "MemberExpression"
      && node.callee.object?.name === "history" && node.callee.property?.name === "listen") {
      found.set("linkingListener", `const linkingListener = ${source.slice(node.arguments[0].start, node.arguments[0].end)};`);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(ast);
  for (const name of [...names, ...(listen ? ["linkingListener"] : [])]) if (!found.has(name)) throw new Error(`Installed SDK function missing: ${relative}:${name}`);
  return [...found.values()].join("\n");
}

const functions = [
  extract("layouts/StackClient.js", ["isStackAction", "isPreviewAction", "getZoomTransitionIdFromAction", "stackRouterOverride", "getActionSingularIdFn", "filterSingular"]),
  extract("fork/createMemoryHistory.js", ["createMemoryHistory"]),
  extract("fork/useLinking.js", ["findMatchingState", "onStateChange"], true),
].join("\n");
const rootNames = ["prof", "coord", "class/[id]", "class/[id]/visual-tech", "class/[id]/scouting", "event"];
const config = { screens: {
  prof: { path: "prof", screens: { calendar: "calendar", home: "home", profile: { path: "profile", screens: { index: "", settings: "settings" } } } },
  coord: { path: "coord", screens: { dashboard: "dashboard" } },
  "class/[id]": "class/:id", "class/[id]/visual-tech": "class/:id/visual-tech", "class/[id]/scouting": "class/:id/scouting", event: "event/:id",
} };
export const route = (key: string, name: string, params?: object) => ({ key, name, ...(params ? { params } : {}) });
export const stack = (routes: any[]) => ({ stale: false, type: "stack", key: "actual-root-stack", index: routes.length - 1,
  routeNames: rootNames, preloadedRoutes: [], routes });

function actualRouteConfig() {
  const app = path.join(process.cwd(), "app");
  const walk = (folder: string): string[] => readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(filename) : /\.[jt]sx?$/.test(entry.name) ? ["./" + path.relative(app, filename).replaceAll("\\", "/")] : [];
  });
  // The full file inventory is real. Only UI component imports are replaced,
  // preventing auth/provider/DB side effects while the SDK constructs its tree.
  const keys = walk(app).sort();
  const context = Object.assign((_key: string) => ({ default: () => null }), { keys: () => keys });
  const tree = sdkRoutes.getRoutes(context, { platform: "web", skipGenerated: true, ignoreEntryPoints: true, importMode: "lazy" });
  const module = vm.runInNewContext(`${extract("getLinkingConfig.js", ["getNavigationConfig", "isPathInRootConfig", "generateLinkingPathInRoot"])}\n({getNavigationConfig});`, {
    constants_1: sdkConstants, getReactNavigationConfig_1: sdkConfig,
  });
  return { keys, tree, config: module.getNavigationConfig(tree, true, { sitemap: false, notFound: false }) };
}
export const actual = actualRouteConfig();
export function wrappedRoot(inner: any) {
  // Hydrate the generated INTERNAL_SLOT using the installed SDK reducer too.
  const base = sdkBase.StackRouter({ initialRouteName: sdkConstants.INTERNAL_SLOT_NAME });
  const names = Object.keys(actual.config.screens);
  return base.getRehydratedState({ routes: [{ name: sdkConstants.INTERNAL_SLOT_NAME, state: inner }] }, {
    routeNames: names, routeParamList: {}, routeGetIdList: {},
  });
}

export function scoutingCallback(bindings: object) {
  const source = readFileSync(path.join(process.cwd(), "app/class/[id].tsx"), "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
  let callback: any;
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclarator" && node.id?.name === "handleOpenScouting") callback = node.init;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(ast);
  if (callback?.type !== "ArrowFunctionExpression" || callback.returnType || callback.params.length) throw new Error("Actual scouting callback changed shape; review the callsite proof.");
  return vm.runInNewContext(`(${source.slice(callback.start, callback.end)})`, { navigateToDetailRoute, ...bindings });
}

function browserBoundary(initialPath: string) {
  const listeners = new Set<() => void>();
  const entries = [{ path: initialPath, state: null as any }]; let index = 0;
  const location = { pathname: "", search: "", hash: "" };
  const update = () => { const url = new URL(entries[index].path, "http://fixture.local"); Object.assign(location, {
    pathname: url.pathname, search: url.search, hash: url.hash,
  }); };
  const history = {
    get state() { return entries[index].state; },
    pushState: jest.fn((state: object, _title: string, href: string) => {
      entries.splice(index + 1); entries.push({ state, path: href }); index++; update();
    }),
    replaceState: jest.fn((state: object, _title: string, href: string) => { entries[index] = { state, path: href }; update(); }),
    go: (amount: number) => {
      const next = Math.max(0, Math.min(entries.length - 1, index + amount)); if (next === index) return;
      index = next; update(); queueMicrotask(() => { for (const listener of [...listeners]) listener(); });
    },
  };
  const win = { history, location, document: { title: "Go Atleta SDK fixture" },
    addEventListener: (name: string, listener: () => void) => { if (name === "popstate") listeners.add(listener); },
    removeEventListener: (_name: string, listener: () => void) => listeners.delete(listener),
  };
  update(); return { win, entries, current: () => entries[index].path, index: () => index };
}

export function tabState(name: "prof" | "coord", screen: string, params?: object) {
  const routeNames = name === "prof" ? ["home", "profile", "calendar"] : ["dashboard"];
  const router = sdkTab.TabRouter({ initialRouteName: routeNames[0], backBehavior: "fullHistory" });
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  return router.getStateForAction(router.getInitialState(options), { type: "NAVIGATE", payload: { name: screen, params } }, options);
}

/** Executes the installed StackClient composition, linking listener and state callback. */
export function fixture(initial: any, unsynchronizedReference = false) {
  const fixtureConfig = { screens: { __root: { path: "", screens: config.screens } } };
  const options = { routeNames: initial.routeNames ?? rootNames, routeParamList: {}, routeGetIdList: {} };
  const base = sdkBase.StackRouter({ initialRouteName: "prof" });
  const outer = sdkBase.StackRouter({ initialRouteName: "__root" });
  const outerOptions = { routeNames: ["__root"], routeParamList: {}, routeGetIdList: {} };
  let rootState: any;
  let flush = Promise.resolve();
  const context: any = {
    non_secure_1: sdkRandom, navigationParams_1: sdkParams, native_1: sdkFocused,
    useScreens_1: { getSingularId: () => { throw new Error("Explicit SDK singular identity required"); } },
    exports: {}, props: { UNSTABLE_router: withWebStackHistory }, react_1: { useMemo: (factory: () => unknown) => factory() },
    enabled: true, previousStateRef: { current: undefined }, previousIndexRef: { current: 0 },
    pendingPopStatePathRef: { current: undefined }, configRef: { current: fixtureConfig },
    getStateFromPathRef: { current: sdkParser.getStateFromPath }, getActionFromStateRef: { current: sdkActions.getActionFromState },
    validateRoutesNotExistInRootState: () => false, onUnhandledLinking: jest.fn(), setTimeout, clearTimeout,
    getPathForRoute: (_route: unknown, state: any) => sdkSerializer.getPathFromState(state, fixtureConfig),
    store: { get state() { return rootState; } },
  };
  const installed = unsynchronizedReference ? functions.replace(/\bindex\s*=\s*history\.index\s*;/, "") : functions;
  const sdk = vm.runInNewContext(`${installed}\nexports.stackRouterOverride=stackRouterOverride;\n${extract("layouts/StackClient.js", ["routerOverride"])}\n({routerOverride,createMemoryHistory,onStateChange,linkingListener});`, context);
  const router = { ...base, ...sdk.routerOverride(base) };
  const inner = router.getRehydratedState(initial, options);
  rootState = outer.getRehydratedState({ routes: [{ name: "__root", state: inner }] }, outerOptions);
  const initialPath = context.getPathForRoute(null, rootState);
  const browser = browserBoundary(initialPath); context.window = browser.win; context.location = browser.win.location;
  const replaceInner = (state: any) => ({ ...rootState, routes: [{ ...rootState.routes[0], state }] });
  const publish = (state: any) => { rootState = state; flush = flush.then(() => sdk.onStateChange()); };
  context.ref = { current: {
    getRootState: () => rootState,
    resetRoot: (raw: any) => {
      const hydrated = outer.getRehydratedState(raw, outerOptions);
      publish({ ...hydrated, routes: hydrated.routes.map((route: any) => ({ ...route, state: router.getRehydratedState(route.state, options) })) });
    },
    dispatch: (action: any) => { throw new Error(`Recorded history should restore exact state, not dispatch ${action.type}`); },
  } };
  context.previousStateRef.current = rootState;
  context.history = sdk.createMemoryHistory(); context.history.replace({ path: initialPath, state: rootState });
  context.history.listen(sdk.linkingListener);
  browser.win.history.pushState.mockClear(); browser.win.history.replaceState.mockClear();
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser.win });
  const action = (value: any) => {
    const next = router.getStateForAction(rootState.routes[0].state, value, options);
    if (next) publish(replaceInner(next)); return next;
  };
  const navigate = (type: string, href: any, navigationOptions?: any) => {
    const name = typeof href === "string" ? href.split("/")[1] : href.pathname.replace(/^\//, "");
    const params = typeof href === "string" ? { screen: href.split("/")[2] } : href.params;
    const next = router.getStateForAction(rootState.routes[0].state, {
      type, payload: { name, params, singular: navigationOptions?.dangerouslySingular },
    }, options);
    if (!next) throw new Error("Installed SDK rejected navigation fixture");
    const target = next.routes[next.index];
    if ((name === "prof" || name === "coord") && params?.screen) {
      const routeNames = name === "prof" ? ["home", "profile", "calendar"] : ["dashboard"];
      const tabs = sdkTab.TabRouter({ initialRouteName: routeNames[0], backBehavior: "fullHistory" });
      const tabOptions = { routeNames, routeParamList: {}, routeGetIdList: {} };
      const current = tabs.getRehydratedState(target.state ?? { routes: [] }, tabOptions);
      const child = tabs.getStateForAction(current, { type: "NAVIGATE", payload: { name: params.screen, params: params.params } }, tabOptions);
      publish(replaceInner({ ...next, routes: next.routes.map((route: any) => route.key === target.key ? { ...route, state: child } : route) }));
    } else publish(replaceInner(next));
  };
  const sync = async () => { for (let count = 0; count < 30; count++) await Promise.resolve(); await flush; };
  return {
    browser, router, options, sync, action,
    state: () => rootState.routes[0].state, rootState: () => rootState,
    imperative: { push: jest.fn((href: any, opts?: any) => navigate("PUSH", href, opts)),
      replace: jest.fn((href: any, opts?: any) => navigate("REPLACE", href, opts)),
      navigate: jest.fn((href: any, opts?: any) => navigate("NAVIGATE", href, opts)) },
    back: async () => { browser.win.history.go(-1); await sync(); },
    forward: async () => { browser.win.history.go(1); await sync(); },
    memory: () => ({ index: context.history.index,
      entries: browser.entries.map((_entry, index) => context.history.get(index)) }),
  };
}
