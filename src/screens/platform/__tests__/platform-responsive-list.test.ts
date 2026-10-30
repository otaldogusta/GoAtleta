import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { PlatformAccessDashboard } from "../PlatformAccessDashboard";
import { isPlatformAdmin, platformListAccessRequests, platformReviewAccessRequest } from "../../../api/organization-access-requests";

const mockToast = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: mockToast }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../components/ui/ScreenPageHeader", () => ({ ScreenPageHeader: () => null }));
jest.mock("../../../api/organization-access-requests", () => ({
  isPlatformAdmin: jest.fn(),
  platformListAccessRequests: jest.fn(),
  platformReviewAccessRequest: jest.fn(),
}));

test("adapts access rows to their measured region while preserving filters and preview isolation", async () => {
  const screen = render(createElement(PlatformAccessDashboard, { designPreview: true }));
  await screen.findAllByText("Alessandro");
  const list = screen.getByTestId("platform-access-list");
  const resizeList = (width: number) => fireEvent(list, "layout", { nativeEvent: { layout: { width, height: 600, x: 0, y: 0 } } });

  resizeList(528);
  expect(screen.queryByText("USUÁRIO")).toBeNull();
  expect(screen.getAllByText("Alessandro").length).toBeGreaterThan(0);
  resizeList(920);
  expect(screen.getByText("USUÁRIO")).toBeTruthy();
  expect(screen.getByText("SOLICITADO EM")).toBeTruthy();

  fireEvent.changeText(screen.getByPlaceholderText("Buscar usuário, instituição..."), "Alessandro");
  resizeList(288);
  expect(screen.queryByText("USUÁRIO")).toBeNull();
  expect(screen.getByPlaceholderText("Buscar usuário, instituição...").props.value).toBe("Alessandro");
  expect(screen.getAllByText("Alessandro").length).toBeGreaterThan(0);
  expect(isPlatformAdmin).not.toHaveBeenCalled();
  expect(platformListAccessRequests).not.toHaveBeenCalled();
  expect(platformReviewAccessRequest).not.toHaveBeenCalled();
});
