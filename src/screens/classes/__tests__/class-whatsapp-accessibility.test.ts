import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { View, Text, Pressable, Platform } from "react-native";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = ts.createSourceFile("class.tsx", readFileSync(resolve("app/class/[id].tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate: (node: ts.Node) => boolean): ts.Node {
  let match: ts.Node | undefined;
  const visit = (node: ts.Node) => { if (!match && predicate(node)) match = node; if (!match) ts.forEachChild(node, visit); };
  visit(source); if (!match) throw Error("Class WhatsApp callback missing"); return match;
}
function evaluate(node: ts.Node, scope: Record<string, unknown>) {
  const code = ts.transpileModule(`return (${node.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  return new Function(...Object.keys(scope), code)(...Object.values(scope));
}

test("keeps the navigation FAB outside WhatsApp and the previously guarded sheets", () => {
  const condition = (find(node => ts.isConditionalExpression(node) && node.whenTrue.getText(source).includes("<ClassNavigationFab")) as ts.ConditionalExpression).condition;
  const scope = { compactClassWorkspace: true, classNavigationOpen: false, showReportModal: false, showReportHistory: false, showEditModal: false, showRosterExportModal: false, showWhatsAppSettingsModal: false };
  expect(evaluate(condition, scope)).toBe(true);
  for (const key of ["showWhatsAppSettingsModal", "showRosterExportModal", "showReportModal", "classNavigationOpen"]) {
    expect(evaluate(condition, { ...scope, [key]: true })).toBe(false);
  }
});

test("returns focus after closing WhatsApp only on the focused compact web route", () => {
  const modal = find(node => ts.isJsxOpeningElement(node) && node.tagName.getText(source) === "ModalSheet" && node.getText(source).includes("visible={showWhatsAppSettingsModal}")) as ts.JsxOpeningElement;
  const exit = modal.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === "onExited") as ts.JsxAttribute;
  const callback = (exit.initializer as ts.JsxExpression).expression!;
  const focus = jest.fn(), getElementById = jest.fn(() => ({ focus }));
  for (const [os, focused, compact] of [["web", true, true], ["web", false, true], ["web", true, false], ["ios", true, true]] as const) {
    evaluate(callback, { Platform: { OS: os }, classRouteFocused: focused, compactClassWorkspace: compact, document: { getElementById } })();
  }
  expect(getElementById).toHaveBeenCalledTimes(1);
  expect(getElementById).toHaveBeenCalledWith("class-navigation-fab");
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});

test("exposes the selected contact and invokes only its local selection callback", () => {
  const row = find(node => ts.isFunctionExpression(node) && node.name?.text === "WhatsAppContactRow") as ts.FunctionExpression;
  const Component = evaluate(row, { React, Pressable, View, Text, Platform, GoAtletaIcon: () => null });
  const onSelect = jest.fn();
  const props = { contact: { studentName: "Atleta QA", phone: "5511900000002", source: "guardian" }, index: 2, isSelected: false, onSelect, colors: {}, subtleSurface: "transparent", borderColor: "transparent", mutedColor: "gray" };
  const screen = render(React.createElement(Component, props));
  fireEvent.press(screen.getByRole("button", { name: /Atleta QA, Responsável/, selected: false }));
  expect(onSelect).toHaveBeenCalledWith(2);
  screen.rerender(React.createElement(Component, { ...props, isSelected: true }));
  expect(screen.getByRole("button", { name: /Atleta QA, Responsável/, selected: true })).toBeTruthy();
});
