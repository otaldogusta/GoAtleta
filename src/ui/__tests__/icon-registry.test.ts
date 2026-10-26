import React from "react";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

import { GOATLETA_ICON_NAMES, GoAtletaIcon, PixLogoIcon } from "../icon-registry";

// Exercise the real SDK icon components and glyph maps; font loading belongs to
// the browser/native smoke and is already complete at this unit-test boundary.
jest.mock("expo-font", () => ({ isLoaded: () => true, loadAsync: jest.fn(async () => {}) }));

test("registered icons retain their original SDK glyphs and decorative accessibility", () => {
  expect(Object.values(GOATLETA_ICON_NAMES).every(name => Number.isInteger(Ionicons.glyphMap[name]))).toBe(true);
  const screen = render(React.createElement(GoAtletaIcon, { name: "home", size: 24, color: "#123456" }));
  const icon = screen.UNSAFE_getByType(Ionicons);
  expect(icon.props).toMatchObject({ name: "home-outline", size: 24, color: "#123456", accessible: false, "aria-hidden": true });
  const glyph = screen.getByText(String.fromCodePoint(Ionicons.glyphMap["home-outline"]), { includeHiddenElements: true });
  expect(StyleSheet.flatten(glyph.props.style)).toMatchObject({ fontFamily: Ionicons.getFontFamily(), fontSize: 24, color: "#123456" });
});

test("Pix keeps the existing MaterialIcons component, glyph, size and color", () => {
  const screen = render(React.createElement(PixLogoIcon, { size: 21, color: "#654321" }));
  expect(screen.UNSAFE_getByType(MaterialIcons).props).toMatchObject({ name: "pix", size: 21, color: "#654321", accessible: false });
  const glyph = screen.getByText(String.fromCodePoint(MaterialIcons.glyphMap.pix), { includeHiddenElements: true });
  expect(StyleSheet.flatten(glyph.props.style)).toMatchObject({ fontFamily: MaterialIcons.getFontFamily(), fontSize: 21, color: "#654321" });
});
