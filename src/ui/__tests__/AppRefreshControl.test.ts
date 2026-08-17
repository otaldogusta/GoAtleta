import { render } from "@testing-library/react-native";
import { createElement } from "react";
import { Text } from "react-native";

import { AppRefreshControl } from "../AppRefreshControl";

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const mocked = Object.create(actual);
  Object.defineProperties(mocked, {
    Platform: {
      value: Object.assign(Object.create(actual.Platform), { OS: "android" }),
    },
    RefreshControl: { value: actual.View },
  });
  return mocked;
});

describe("AppRefreshControl", () => {
  it("preserva o conteúdo que o ScrollView injeta no controle nativo", () => {
    const { getByText } = render(
      createElement(
        AppRefreshControl,
        { refreshing: false, onRefresh: jest.fn() },
        createElement(Text, null, "Conteúdo da tela"),
      ),
    );

    expect(getByText("Conteúdo da tela")).toBeTruthy();
  });
});
