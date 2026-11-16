import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import LoginScreen from "../../../../app/login";

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
  useRouter: () => ({}),
}));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({}) }));
jest.mock("../../../observability/perf", () => ({
  markRender: jest.fn(),
  measureAsync: (_name: string, run: () => Promise<unknown>) => run(),
}));
jest.mock("../../../security/biometric-lock", () => ({ useBiometricLock: () => ({}) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: {} }) }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("../../../components/ui/ScreenBackdrop", () => ({ ScreenBackdrop: () => null }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));

it("only renders the password visibility action while the password has text", async () => {
  const view = render(React.createElement(LoginScreen));
  await act(async () => { await Promise.resolve(); });

  const password = () => view.getByLabelText("Senha");
  const visibilityAction = (label: string) => view.queryByRole("button", { name: label, includeHiddenElements: true });

  expect(visibilityAction("Mostrar senha")).toBeNull();
  expect(password().props.secureTextEntry).toBe(true);

  fireEvent.changeText(password(), "SenhaFicticia");
  fireEvent.press(view.getByRole("button", { name: "Mostrar senha" }));
  expect(password().props.secureTextEntry).toBe(false);
  expect(password().props.value).toBe("SenhaFicticia");
  expect(visibilityAction("Ocultar senha")).toBeTruthy();

  fireEvent.changeText(password(), "");
  expect(visibilityAction("Mostrar senha")).toBeNull();
  expect(visibilityAction("Ocultar senha")).toBeNull();
});
