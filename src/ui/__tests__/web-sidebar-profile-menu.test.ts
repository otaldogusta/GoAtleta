import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

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
    availableRoles: ["trainer", "student"],
    refresh: jest.fn(),
    setActiveRole: jest.fn(),
  }),
}));

jest.mock("../../providers/OrganizationProvider", () => ({
  useOptionalOrganization: () => ({
    activeOrganization: { role_level: 50 },
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

jest.mock("../../notifications/useUnreadNotificationCount", () => ({
  useUnreadNotificationCount: () => ({ unreadCount: 0 }),
}));

describe("WebSidebar profile menu", () => {
  beforeEach(() => {
    Object.defineProperty(window, "addEventListener", {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(window, "removeEventListener", {
      configurable: true,
      value: jest.fn(),
    });
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
        showCompact: true,
        canExpand: true,
        canPersistExpansion: true,
      })
    );

    expect(screen.queryByLabelText("Menu de perfil")).toBeNull();

    fireEvent.press(screen.getByLabelText("Abrir menu de perfil"));

    expect(screen.getAllByLabelText("Menu de perfil")).toHaveLength(1);
    expect(screen.getByLabelText("Fechar menu de perfil")).toBeTruthy();
    expect(screen.queryByText("Gustavo Ribeiro")).toBeNull();
    expect(screen.getByText("Perfil e configurações")).toBeTruthy();
    expect(screen.getByText("Sair")).toBeTruthy();
  });

  it("keeps a single profile surface while the sidebar is expanded", () => {
    const screen = render(
      React.createElement(WebSidebar, {
        role: "prof",
        showCompact: true,
        canExpand: true,
        canPersistExpansion: true,
      })
    );

    fireEvent.press(screen.getByLabelText("Expandir menu"));

    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "goatleta:web-sidebar-expanded",
      "expanded"
    );

    expect(screen.queryByLabelText("Navegação principal compacta")).toBeNull();
    fireEvent.press(screen.getByLabelText("Abrir menu de perfil"));

    expect(screen.getAllByLabelText("Menu de perfil")).toHaveLength(1);
    expect(screen.getAllByLabelText("Fechar menu de perfil")).toHaveLength(1);
    expect(screen.getAllByText("Gustavo Ribeiro")).toHaveLength(1);

    fireEvent.press(screen.getByLabelText("Alternar perfil"));

    const profileMenu = screen.getByLabelText("Menu de perfil");
    const workspaceMenu = screen.getByLabelText("Alternar workspace");
    expect(workspaceMenu.parent).not.toBe(profileMenu);
    expect(workspaceMenu.props.style).toEqual(
      expect.objectContaining({ left: 280 })
    );
  });

  it("allows temporary tablet expansion without persisting it", () => {
    const screen = render(
      React.createElement(WebSidebar, {
        role: "prof",
        showCompact: true,
        canExpand: true,
        canPersistExpansion: false,
      })
    );

    fireEvent.press(screen.getByLabelText("Expandir menu"));

    expect(screen.getByLabelText("Recolher menu")).toBeTruthy();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("opens the mobile navigation overlay from the global menu event", () => {
    const screen = render(
      React.createElement(WebSidebar, {
        role: "prof",
        showCompact: false,
        canExpand: false,
        canPersistExpansion: false,
      })
    );

    expect(screen.queryByLabelText("Fechar menu lateral")).toBeNull();

    const toggleListener = (window.addEventListener as jest.Mock).mock.calls.find(
      ([eventName]) => eventName === "goatleta:toggle-sidebar"
    )?.[1];
    expect(toggleListener).toEqual(expect.any(Function));

    act(() => toggleListener());

    expect(screen.getByLabelText("Fechar menu lateral")).toBeTruthy();
    expect(screen.getByLabelText("Recolher menu")).toBeTruthy();
    expect(screen.queryByLabelText("Navegação principal compacta")).toBeNull();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText("Hoje"));

    expect(screen.queryByLabelText("Fechar menu lateral")).toBeNull();
    expect(screen.queryByLabelText("Recolher menu")).toBeNull();
  });
});
