import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Platform } from "react-native";
import { AssistantModelSelector } from "../AssistantModelSelector";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { ASSISTANT_MODEL_CHOICES } from "../../model-choice";

jest.mock("react-native", () => {
  const React = jest.requireActual("react");
  return Object.defineProperties({}, {
    ...Object.getOwnPropertyDescriptors(jest.requireActual("react-native")),
    View: { configurable: true, enumerable: true, value: React.forwardRef(function MockView(props: Record<string, unknown>, ref: unknown) { return React.createElement("View", { ...props, ref }); }) },
  });
});
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null }));

const originals = [
  { target: Platform, key: "OS" }, { target: window, key: "addEventListener" }, { target: window, key: "removeEventListener" },
].map(item => ({ ...item, descriptor: Object.getOwnPropertyDescriptor(item.target, item.key) }));
let view: ReactTestRenderer;
let keys: Map<string, (event: unknown) => void>;
let windowKeys: Map<string, (event: unknown) => void>;
let options: { focus: jest.Mock; getAttribute: jest.Mock; closest: jest.Mock; scrollIntoView: jest.Mock }[];
const triggerFocus = jest.fn();
const onChange = jest.fn();
const trigger = () => view.root.findAll(n => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Modelo: ") && typeof n.props.onPress === "function")[0];
const event = (key: string, index = 0) => ({ key, target: options[index], preventDefault: jest.fn(), stopPropagation: jest.fn() });
function mount(keyboardNavigation = true, value = ASSISTANT_MODEL_CHOICES[0].value) {
  options.forEach((option, index) => option.getAttribute.mockReturnValue(ASSISTANT_MODEL_CHOICES[index].value === value ? "true" : "false"));
  act(() => { view = create(React.createElement(AssistantModelSelector, { value, onChange, keyboardNavigation }), {
    createNodeMock: node => {
      if (node.props.collapsable === false) return {
        measureInWindow: (callback: (...args: number[]) => void) => callback(0, 0, 120, 44),
        querySelector: () => ({ focus: triggerFocus }), contains: () => false,
      };
      if (node.props.nativeID) return {
        querySelectorAll: () => options, contains: (target: unknown) => options.includes(target as typeof options[number]),
        addEventListener: (name: string, handler: (event: unknown) => void) => keys.set(name, handler),
        removeEventListener: (name: string) => keys.delete(name),
      };
      return null;
    },
  }); });
  act(() => trigger().props.onPress());
}

beforeEach(() => {
  keys = new Map(); windowKeys = new Map(); jest.clearAllMocks();
  options = ASSISTANT_MODEL_CHOICES.map((_, index) => ({ focus: jest.fn(), getAttribute: jest.fn(() => index === 0 ? "true" : "false"), closest: jest.fn(() => options[index]), scrollIntoView: jest.fn() }));
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  Object.defineProperty(window, "addEventListener", { configurable: true, value: (name: string, handler: (event: unknown) => void) => windowKeys.set(name, handler) });
  Object.defineProperty(window, "removeEventListener", { configurable: true, value: (name: string) => windowKeys.delete(name) });
});
afterEach(() => {
  if (view) act(() => view.unmount());
  for (const { target, key, descriptor } of originals) {
    if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key);
  }
});

test("opens on the selected model, exposes tab stops and supports arrow navigation", () => {
  mount();
  expect(trigger().props["aria-expanded"]).toBe(true);
  expect(options[0].focus).toHaveBeenCalledWith({ preventScroll: true });
  for (const choice of ASSISTANT_MODEL_CHOICES) {
    const option = view.root.findAll(n => n.props.accessibilityLabel === choice.label && typeof n.props.onPress === "function")[0];
    expect(option.props.tabIndex).toBe(0);
  }
  const next = event("ArrowDown");
  act(() => keys.get("keydown")?.(next));
  expect(options[1].focus).toHaveBeenCalledWith({ preventScroll: true });
  const tab = event("Tab");
  act(() => keys.get("keydown")?.(tab));
  expect(tab.preventDefault).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});

test("selects one model and returns to the trigger", () => {
  mount();
  const option = view.root.findAll(n => n.props.accessibilityLabel === ASSISTANT_MODEL_CHOICES[1].label && typeof n.props.onPress === "function")[0];
  act(() => option.props.onPress());
  expect(onChange).toHaveBeenCalledWith(ASSISTANT_MODEL_CHOICES[1].value);
  expect(trigger().props["aria-expanded"]).toBe(false);
  expect(triggerFocus).toHaveBeenCalledTimes(1);
});

test("reveals the last selected model when opening a height-limited menu", () => {
  const last = ASSISTANT_MODEL_CHOICES.length - 1;
  mount(true, ASSISTANT_MODEL_CHOICES[last].value);
  expect(options[last].focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(options[last].scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  expect(options[0].focus).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});

test("returns focus on Escape but not on outside dismissal", () => {
  mount();
  act(() => windowKeys.get("keydown")?.(event("Escape")));
  expect(triggerFocus).toHaveBeenCalledTimes(1);
  expect(onChange).not.toHaveBeenCalled();
  act(() => trigger().props.onPress());
  triggerFocus.mockClear();
  act(() => view.root.findByType(AnchoredDropdown).props.onRequestClose());
  expect(triggerFocus).not.toHaveBeenCalled();
  expect(trigger().props["aria-expanded"]).toBe(false);
});

test("keeps default consumers outside the opt-in focus behavior", () => {
  mount(false);
  expect(options[0].focus).not.toHaveBeenCalled();
  expect(windowKeys.size).toBe(0);
  expect(trigger().props["aria-expanded"]).toBeUndefined();
});
