import React, { createRef } from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { StyleSheet, Text as NativeText } from "react-native";

import { OperationalText as Text } from "../OperationalText";

test("uses the operational body default without overriding native text settings", () => {
  const view = render(React.createElement(Text, { accessibilityLabel: "Resumo", selectable: true, allowFontScaling: true, maxFontSizeMultiplier: 2 }, "Treino de hoje"));
  const text = view.getByLabelText("Resumo");
  expect(text).toHaveStyle({ fontSize: 12 });
  expect(text.props).toMatchObject({ selectable: true, allowFontScaling: true, maxFontSizeMultiplier: 2 });
});

test("preserves explicit typography and leaves nested emphasis to native inheritance", () => {
  const view = render(React.createElement(Text, { testID: "total", style: [{ fontSize: 18 }, { fontSize: 20, lineHeight: 26 }] },
    "Total ",
    React.createElement(Text, { testID: "emphasis", style: { fontWeight: "700" } }, "42"),
    React.createElement(NativeText, { testID: "native-emphasis", style: { fontStyle: "italic" } }, " alunos"),
  ));
  expect(view.getByTestId("total")).toHaveStyle({ fontSize: 20, lineHeight: 26 });
  expect(view.getByTestId("emphasis")).toHaveStyle({ fontWeight: "700" });
  expect(StyleSheet.flatten(view.getByTestId("emphasis").props.style)).not.toHaveProperty("fontSize");
  expect(StyleSheet.flatten(view.getByTestId("native-emphasis").props.style)).not.toHaveProperty("fontSize");
});

test("forwards native interaction and refs", () => {
  const onPress = jest.fn();
  const ref = createRef<NativeText>();
  const view = render(React.createElement(Text, { ref, onPress, testID: "action" }, "Abrir detalhes"));
  fireEvent.press(view.getByTestId("action"));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(ref.current).not.toBeNull();
});
