import { createElement, useEffect } from "react";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { RefreshFeedbackProvider, useRefreshFeedback } from "../RefreshFeedbackProvider";
let mounts = 0;
jest.mock("../app-theme", () => ({ useAppTheme: () => ({ colors: { primaryBg: "#00ff00" } }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 20 }) }));
jest.mock("../useRefreshTransition", () => ({
  useRefreshTransition: (refreshing: boolean) => ({ visible: refreshing, progress: 1 }),
}));
function Screen({ refreshing }: { refreshing: boolean }) {
  const feedback = useRefreshFeedback();
  useEffect(() => { mounts += 1; }, []);
  useEffect(() => {
    feedback?.("test", refreshing ? { refreshing: true, pull: 0 } : null);
    return () => feedback?.("test", null);
  }, [feedback, refreshing]);
  return createElement(Text, null, "Conteúdo existente");
}
it("keeps one mounted screen without a loading overlay", () => {
  mounts = 0;
  const screen = render(createElement(RefreshFeedbackProvider, null, createElement(Screen, { refreshing: false })));
  screen.rerender(createElement(RefreshFeedbackProvider, null, createElement(Screen, { refreshing: true })));
  expect(screen.getAllByText("Conteúdo existente")).toHaveLength(1);
  expect(screen.queryByLabelText("Atualizando conteúdo da tela")).toBeNull();
  expect(screen.getByLabelText("Atualizando dados")).toBeTruthy();
  expect(mounts).toBe(1);
  screen.rerender(createElement(RefreshFeedbackProvider, null, createElement(Screen, { refreshing: false })));
  expect(mounts).toBe(1);
});
