import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { CourtSaveStatus } from "../CourtSaveStatus";

jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: "GoAtletaIcon" }));

describe("court autosave feedback", () => {
  let tree: TestRenderer.ReactTestRenderer;
  afterEach(() => { if (tree) act(() => tree.unmount()); });

  it.each(["idle", "pending", "saving", "saved"] as const)("does not expose a save button while %s", status => {
    const retry = jest.fn();
    act(() => { tree = TestRenderer.create(React.createElement(CourtSaveStatus, { status, onRetry: retry })); });
    expect(tree.root.findAllByProps({ accessibilityRole: "button" })).toHaveLength(0);
    expect(retry).not.toHaveBeenCalled();
  });

  it.each(["local", "error"] as const)("allows retry after %s without automatically repeating it", status => {
    const retry = jest.fn();
    act(() => { tree = TestRenderer.create(React.createElement(CourtSaveStatus, { status, onRetry: retry })); });
    const button = () => tree.root.findByProps({ accessibilityRole: "button" });
    expect(retry).not.toHaveBeenCalled();
    act(() => button().props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
    act(() => tree.update(React.createElement(CourtSaveStatus, { status, onRetry: retry, disabled: true })));
    act(() => button().props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
