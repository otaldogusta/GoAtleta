import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { loadLazySource } from "./lazy-source-fixture";

type Props = { isoCode: string; size?: number };
let CountryFlagIcon: React.ComponentType<Props>;
let view: ReactTestRenderer | undefined;
let resolveModule: (value: object) => void, rejectModule: (error: Error) => void;
let loadChunk: jest.Mock;
const flags = { BR: (props: object) => React.createElement("svg", { ...props, "data-country": "BR" }),
  PT: (props: object) => React.createElement("svg", { ...props, "data-country": "PT" }) };
const flush = () => act(async () => { for (let count = 0; count < 8; count++) await Promise.resolve(); });
const mount = (props: Props = { isoCode: "BR" }) => act(() => { view = create(React.createElement(CountryFlagIcon, props)); });
const loaded = async () => { await act(async () => resolveModule(flags)); };
beforeEach(() => {
  loadChunk = jest.fn(() => new Promise((resolve, reject) => { resolveModule = resolve; rejectModule = reject; }));
  CountryFlagIcon = loadLazySource<{ CountryFlagIcon: React.ComponentType<Props> }>("src/ui/CountryFlagIcon.web.tsx", loadChunk,
    name => jest.requireActual(name)).CountryFlagIcon;
});
afterEach(() => { act(() => { view?.unmount(); view = undefined; }); });

test("the source does not load the flags barrel until an icon mounts", async () => {
  expect(loadChunk).not.toHaveBeenCalled(); mount();
  expect(loadChunk).toHaveBeenCalledTimes(1); expect(loadChunk).toHaveBeenCalledWith("country-flag-icons/react/3x2");
  expect(view!.root.findByType("span").props.style).toMatchObject({ width: 27, height: 18, display: "block", flexShrink: 0, borderRadius: 3 });
  await loaded(); expect(view!.root.findByType("svg").props).toMatchObject({ "data-country": "BR", "aria-hidden": true });
});

test("a rejected decorative chunk keeps the reserved area and country/DDI control usable, and a new mount retries", async () => {
  act(() => { view = create(React.createElement("div", null, React.createElement(CountryFlagIcon, { isoCode: "BR" }),
    React.createElement("button", { "aria-label": "País e DDI" }, "+55"))); });
  const reserved = view!.root.findByType("span").props.style;
  await act(async () => rejectModule(new Error("Chunk unavailable")));
  expect(view!.root.findByType("span").props.style).toEqual(reserved);
  expect(view!.root.findByType("span").props["aria-hidden"]).toBe(true);
  expect(view!.root.findByProps({ "aria-label": "País e DDI" }).props.children).toBe("+55");
  expect(loadChunk).toHaveBeenCalledTimes(1);
  act(() => { view!.unmount(); view = undefined; }); mount(); expect(loadChunk).toHaveBeenCalledTimes(2);
  await loaded(); expect(view!.root.findAllByType("svg")).toHaveLength(1);
});

test("concurrent icons share one load and preserve lowercase ISO lookup and final SVG props", async () => {
  act(() => { view = create(React.createElement("div", null, React.createElement(CountryFlagIcon, { isoCode: "br" }),
    React.createElement(CountryFlagIcon, { isoCode: "PT", size: 20 }))); });
  expect(loadChunk).toHaveBeenCalledTimes(1); await loaded(); const rendered = view!.root.findAllByType("svg");
  expect(rendered.map(flag => flag.props["data-country"])).toEqual(["BR", "PT"]);
  expect(rendered[0].props).toMatchObject({ "aria-hidden": true, style: { width: 27, height: 18, display: "block", borderRadius: 3, objectFit: "cover", flexShrink: 0 } });
  expect(rendered[1].props.style).toMatchObject({ width: 30, height: 20 });
});

test("unknown ISO codes retain the former empty result once the module is available", async () => {
  mount({ isoCode: "XX" }); await loaded(); expect(view!.toJSON()).toBeNull();
});

test.each([18, 21, 32])("placeholder and SVG reserve identical dimensions at size %s", async size => {
  mount({ isoCode: "BR", size }); const reserved = view!.root.findByType("span").props.style;
  expect(reserved.width).toBe(Math.round(size * 1.5)); expect(reserved.height).toBe(size);
  expect(view!.root.findByType("span").props.children).toBeUndefined();
  await loaded(); expect(view!.root.findByType("svg").props.style).toEqual(reserved);
});

test("prop changes reuse the loaded module and preserve final accessibility props", async () => {
  mount(); await loaded(); act(() => view!.update(React.createElement(CountryFlagIcon, { isoCode: "pt", size: 24 })));
  expect(view!.root.findByType("svg").props).toMatchObject({ "data-country": "PT", style: { width: 36, height: 24 } });
  expect(loadChunk).toHaveBeenCalledTimes(1);
  act(() => { view!.unmount(); view = undefined; }); await flush();
});
