import { fireEvent, render } from "@testing-library/react-native";
import { createElement } from "react";
import { Text, View } from "react-native";

import { AppRefreshControl } from "../AppRefreshControl";

let mockPlatformOS = "android";
let mockFeedback: jest.Mock | null = null;

jest.mock("../app-theme", () => ({
  useAppTheme: () => ({ colors: { text: "#f1f5f9", card: "#162133" } }),
}));

jest.mock("../RefreshFeedbackProvider", () => ({
  useRefreshFeedback: () => mockFeedback,
}));

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
  it("aplica fundo do tema ao indicador Android para preservar contraste", () => {
    const screen = render(createElement(AppRefreshControl, { refreshing: true, tintColor: "#f1f5f9", testID: "refresh" }));
    expect(screen.getByTestId("refresh").props.colors).toEqual(["#f1f5f9"]);
    expect(screen.getByTestId("refresh").props.progressBackgroundColor).toBe("#162133");
  });
  beforeEach(() => {
    mockPlatformOS = "android";
    mockFeedback = null;
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

  it("não transforma a volta ao topo em refresh e libera o próximo gesto", () => {
    const onRefresh = jest.fn();
    const onScroll = jest.fn();
    const onTouchStart = jest.fn();
    const screen = render(createElement(AppRefreshControl, {
      refreshing: false, onRefresh, testID: "refresh",
    }, createElement(View, { testID: "scroll", onScroll, onTouchStart } as any)));
    fireEvent(screen.getByTestId("scroll"), "scroll", { nativeEvent: { contentOffset: { y: 180 } } });
    fireEvent(screen.getByTestId("scroll"), "touchStart", { nativeEvent: {} });
    fireEvent(screen.getByTestId("scroll"), "scroll", { nativeEvent: { contentOffset: { y: 0 } } });
    fireEvent(screen.getByTestId("refresh"), "refresh");
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId("refresh").props.enabled).toBe(false);
    fireEvent(screen.getByTestId("scroll"), "touchStart", { nativeEvent: {} });
    expect(screen.getByTestId("refresh").props.enabled).toBe(true);
    fireEvent(screen.getByTestId("refresh"), "refresh");
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onScroll).toHaveBeenCalledTimes(2);
    expect(onTouchStart).toHaveBeenCalledTimes(2);
  });

  it("não inicia outra atualização enquanto já está carregando", () => {
    const onRefresh = jest.fn();
    const screen = render(createElement(AppRefreshControl, { refreshing: true, onRefresh, testID: "refresh" }));
    fireEvent(screen.getByTestId("refresh"), "refresh");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("reativa o controle depois de cancelar um gesto horizontal no topo", () => {
    const onRefresh = jest.fn();
    const screen = render(createElement(AppRefreshControl, { refreshing: false, onRefresh, testID: "refresh" }, createElement(View, { testID: "scroll" })));
    fireEvent(screen.getByTestId("scroll"), "touchStart", { nativeEvent: { pageX: 0, pageY: 0 } });
    fireEvent(screen.getByTestId("scroll"), "touchMove", { nativeEvent: { pageX: 60, pageY: 4 } });
    expect(screen.getByTestId("refresh").props.enabled).toBe(false);
    fireEvent(screen.getByTestId("scroll"), "touchCancel", { nativeEvent: {} });
    expect(screen.getByTestId("refresh").props.enabled).toBe(true);
    fireEvent(screen.getByTestId("scroll"), "touchStart", { nativeEvent: { pageX: 0, pageY: 0 } });
    fireEvent(screen.getByTestId("refresh"), "refresh");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("mantém o indicador nativo com provider, sem duplicar refresh global", () => {
    mockFeedback = jest.fn();
    const onRefresh = jest.fn();
    const screen = render(createElement(AppRefreshControl, { refreshing: false, onRefresh, testID: "refresh" }));
    expect(screen.getByTestId("refresh").props.onRefresh).toEqual(expect.any(Function));
    expect(screen.getByTestId("refresh").props.onMoveShouldSetResponderCapture).toBeUndefined();
    fireEvent(screen.getByTestId("refresh"), "refresh");
    expect(onRefresh).toHaveBeenCalledTimes(1);
    screen.rerender(createElement(AppRefreshControl, { refreshing: true, onRefresh, testID: "refresh" }));
    expect(screen.getByTestId("refresh").props.refreshing).toBe(true);
    expect(mockFeedback).toHaveBeenCalledWith(expect.any(String), { refreshing: true, pull: 0 });
  });
});
