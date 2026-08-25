import { render } from "@testing-library/react-native";
import { createElement } from "react";
import { Text } from "react-native";

import { AppRefreshControl } from "../AppRefreshControl";

let mockPlatformOS = "android";

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const mocked = Object.create(actual);
  const platform = Object.create(actual.Platform);
  Object.defineProperty(platform, "OS", {
    get: () => mockPlatformOS,
  });
  Object.defineProperties(mocked, {
    Platform: {
      value: platform,
    },
    RefreshControl: { value: actual.View },
  });
  return mocked;
});

describe("AppRefreshControl", () => {
  beforeEach(() => {
    mockPlatformOS = "android";
  });

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

  it("entrega o gesto ao navegador sem executar refresh próprio no web", () => {
    mockPlatformOS = "web";
    const onRefresh = jest.fn();
    const { getByText, queryByLabelText } = render(
      createElement(
        AppRefreshControl,
        { refreshing: false, onRefresh },
        createElement(Text, null, "Conteúdo web"),
      ),
    );

    expect(getByText("Conteúdo web")).toBeTruthy();
    expect(queryByLabelText("Puxe para atualizar")).toBeNull();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
