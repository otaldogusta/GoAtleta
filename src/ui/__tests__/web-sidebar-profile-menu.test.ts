import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { WebSidebar } from "../WebSidebar";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  usePathname: () => "/prof/home",
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock("../icon-registry", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    GoAtletaIcon: ({ name, ...props }: { name: string }) =>
      ReactModule.createElement(Text, props, name),
  };
});

jest.mock("../../auth/auth", () => ({
  useAuth: () => ({
    session: {
      user: {
        email: "professor@goatleta.com",
        user_metadata: { full_name: "Gustavo Ribeiro" },
      },
    },
    signOut: jest.fn(),
  }),
}));

jest.mock("../../auth/role", () => ({
  useRole: () => ({
    availableRoles: ["trainer"],
    refresh: jest.fn(),
    setActiveRole: jest.fn(),
  }),
}));

jest.mock("../../providers/OrganizationProvider", () => ({
  useOptionalOrganization: () => ({
    activeOrganization: { role_level: 10 },
    memberPermissions: {
      calendar: true,
      classes: true,
      periodization: true,
      reports: true,
      students: true,
      training: true,
    },
    permissionsLoading: false,
  }),
}));

describe("WebSidebar profile menu", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
      },
    });
  });

  it("opens from the compact avatar trigger", () => {
    const screen = render(
      React.createElement(WebSidebar, {
        role: "prof",
        canExpand: true,
      })
    );

    expect(screen.queryByLabelText("Menu de perfil")).toBeNull();

    fireEvent.press(screen.getByLabelText("Abrir menu de perfil"));

    expect(screen.getByLabelText("Menu de perfil")).toBeTruthy();
    expect(screen.getByLabelText("Fechar menu de perfil")).toBeTruthy();
    expect(screen.getByText("Gustavo Ribeiro")).toBeTruthy();
    expect(screen.getByText("Perfil e configurações")).toBeTruthy();
    expect(screen.getByText("Sair")).toBeTruthy();
  });
});
