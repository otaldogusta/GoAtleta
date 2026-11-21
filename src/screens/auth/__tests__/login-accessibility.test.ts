import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";
import LoginScreen from "../../../../app/login";

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
  useRouter: () => ({}),
}));
const mockSignIn = jest.fn().mockResolvedValue(undefined);
let mockSession: { user: { id: string } } | null = null;

jest.mock("../../../auth/auth", () => ({
  useAuth: () => ({ session: mockSession, signIn: mockSignIn }),
}));
jest.mock("../../../api/config", () => ({ isSupabaseConfigured: true }));
jest.mock("../../../observability/perf", () => ({
  markRender: jest.fn(),
  measureAsync: (_name: string, run: () => Promise<unknown>) => run(),
}));
jest.mock("../../../security/biometric-lock", () => ({
  useBiometricLock: () => ({ markCredentialLoginSuccess: jest.fn() }),
}));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: {} }) }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("../../../components/ui/ScreenBackdrop", () => ({ ScreenBackdrop: () => null }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/use-responsive-layout", () => ({
  useResponsiveLayout: () => jest.requireActual("../../../ui/responsive-layout").resolveResponsiveLayout(1034),
}));

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it("shows progress when the web login remounts before the authenticated redirect", async () => {
  const originalPlatform = Platform.OS;
  Platform.OS = "web";
  mockSession = { user: { id: "test-user" } };
  try {
    const view = render(React.createElement(LoginScreen));
    await act(async () => { await Promise.resolve(); });
    expect(view.getByTestId("fullscreen-loading-state").props.accessibilityLabel).toBe("Entrando...");
    expect(view.queryByLabelText("E-mail")).toBeNull();
    expect(view.queryByLabelText("Senha")).toBeNull();
    view.unmount();
  } finally {
    mockSession = null;
    Platform.OS = originalPlatform;
  }
});

it("submits from the web email field only once both credentials are filled", async () => {
  const originalPlatform = Platform.OS;
  Platform.OS = "web";
  try {
    const view = render(React.createElement(LoginScreen));
    await act(async () => { await Promise.resolve(); });
    const email = view.getByLabelText("E-mail");
    fireEvent.changeText(email, "teste@example.com");
    fireEvent(email, "submitEditing");
    expect(mockSignIn).not.toHaveBeenCalled();

    fireEvent.changeText(view.getByLabelText("Senha"), "SenhaFicticia");
    await act(async () => { fireEvent(email, "submitEditing"); });
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledWith("teste@example.com", "SenhaFicticia");
  } finally {
    Platform.OS = originalPlatform;
  }
});

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
