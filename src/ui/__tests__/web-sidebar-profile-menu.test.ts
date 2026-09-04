import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";

import { WebSidebar } from "../WebSidebar";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockHistoryPushState = jest.fn();
const mockHistoryReplaceState = jest.fn();
let mockPathname = "/prof/home";
let mockAvailableRoles = ["trainer", "student"];
const mockOrganizationContext = {
  activeOrganization: { id: "org-1", role_level: 50 },
  organizations: [{ id: "org-1", role_level: 50 }],
  setDevProfilePreview: jest.fn(),
  memberPermissions: {
    calendar: true,
    classes: true,
    periodization: true,
    reports: true,
    students: true,
    training: true,
  } as Record<string, boolean>,
  permissionsLoading: false,
};

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
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
    availableRoles: mockAvailableRoles,
    refresh: jest.fn(),
    setActiveRole: jest.fn(),
  }),
}));

jest.mock("../../providers/OrganizationProvider", () => ({
  useOptionalOrganization: () => mockOrganizationContext,
}));

jest.mock("../../notifications/useUnreadNotificationCount", () => ({
  useUnreadNotificationCount: () => ({ unreadCount: 0 }),
}));

describe("WebSidebar profile menu", () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });
    mockPathname = "/prof/home";
    mockAvailableRoles = ["trainer", "student"];
    mockOrganizationContext.organizations = [{ id: "org-1", role_level: 50 }];
    mockPush.mockClear();
    mockReplace.mockClear();
    mockHistoryPushState.mockClear();
    mockHistoryReplaceState.mockClear();
    mockOrganizationContext.activeOrganization.role_level = 50;
    mockOrganizationContext.memberPermissions = {
      calendar: true,
      classes: true,
      periodization: true,
      reports: true,
      students: true,
      training: true,
    };
    mockOrganizationContext.permissionsLoading = false;
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
    Object.defineProperty(window, "history", {
      configurable: true,
      value: {
        state: { key: "current-route" },
        pushState: mockHistoryPushState,
        replaceState: mockHistoryReplaceState,
      },
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: mockPathname,
        search: "",
        hash: "",
      },
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: undefined,
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("keeps only unrestricted professor navigation visible while permissions are loading", () => {
    mockOrganizationContext.organizations[0].role_level = 10;
    mockOrganizationContext.activeOrganization.role_level = 10;
    mockOrganizationContext.memberPermissions = {};
    mockOrganizationContext.permissionsLoading = true;

    const screen = render(
      React.createElement(WebSidebar, {
        role: "prof",
        showCompact: true,
        canExpand: true,
        canPersistExpansion: true,
      })
    );

    expect(screen.getByLabelText("Hoje")).toBeTruthy();
    expect(screen.queryByLabelText("Turmas")).toBeNull();
    expect(screen.queryByLabelText("Planejamento")).toBeNull();
    expect(screen.queryByLabelText("Alunos")).toBeNull();
    expect(screen.queryByLabelText("Notificações")).toBeNull();
  });

  it("shows only routes with an explicit granted permission", () => {
    mockOrganizationContext.organizations[0].role_level = 10;
    mockOrganizationContext.activeOrganization.role_level = 10;
    mockOrganizationContext.memberPermissions = { classes: false, training: true };

    const screen = render(
      React.createElement(WebSidebar, {
        role: "prof",
        showCompact: true,
        canExpand: true,
        canPersistExpansion: true,
      })
    );

    expect(screen.queryByLabelText("Turmas")).toBeNull();
    expect(screen.getByLabelText("Planejamento")).toBeTruthy();
  });

  it("does not expand the default invite permissions into unrelated areas", () => {
    mockOrganizationContext.organizations[0].role_level = 10;
    mockOrganizationContext.activeOrganization.role_level = 10;
    mockOrganizationContext.memberPermissions = {
      classes: true,
      training: true,
      calendar: true,
      absence_notices: true,
    };

    const screen = render(
      React.createElement(WebSidebar, {
        role: "prof",
        showCompact: true,
        canExpand: true,
        canPersistExpansion: true,
      })
    );

    expect(screen.getByLabelText("Turmas")).toBeTruthy();
    expect(screen.getByLabelText("Planejamento")).toBeTruthy();
    expect(screen.getByLabelText("Calendário mensal")).toBeTruthy();
    expect(screen.getByLabelText("Notificações")).toBeTruthy();
    expect(screen.queryByLabelText("Alunos")).toBeNull();
    expect(screen.queryByLabelText("Consultoria online")).toBeNull();
    expect(screen.queryByLabelText("Periodização")).toBeNull();
    expect(screen.queryByLabelText("Regulamentos")).toBeNull();
    expect(screen.queryByLabelText("Assistente IA")).toBeNull();
  });

  it("adds sidebar destinations to browser history when leaving a class workspace", () => {
    mockPathname = "/class/c_123";
    Object.defineProperty(window, "history", {
      configurable: true,
      value: {
        state: { key: "class" },
        pushState: mockHistoryPushState,
        replaceState: mockHistoryReplaceState,
      },
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/class/c_123",
        search: "",
        hash: "",
      },
    });

    const screen = render(
      React.createElement(WebSidebar, {
        role: "prof",
        showCompact: true,
        canExpand: true,
        canPersistExpansion: true,
      })
    );

    fireEvent.press(screen.getByLabelText("Planejamento"));

    expect(mockHistoryPushState).toHaveBeenCalledWith(
      { key: "class" },
      "",
      "/class/c_123"
    );
    expect(mockReplace).toHaveBeenCalledWith("/prof/planning", {
      withAnchor: true,
    });
    expect(mockPush).not.toHaveBeenCalled();
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

  it("hides the switcher for a professor even with an admin preview in development", () => {
    mockAvailableRoles = ["trainer"];
    mockOrganizationContext.organizations = [{ id: "org-1", role_level: 10 }];
    const screen = render(React.createElement(WebSidebar, {
      role: "coord", showCompact: true, canExpand: true, canPersistExpansion: true,
    }));
    fireEvent.press(screen.getByLabelText("Abrir menu de perfil"));
    expect(screen.queryByLabelText("Alternar perfil")).toBeNull();
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

  it("opens the finance workspace expanded while preserving the collapse control", () => {
    mockPathname = "/coord/finance";
    const screen = render(
      React.createElement(WebSidebar, {
        role: "coord",
        showCompact: true,
        canExpand: true,
        canPersistExpansion: true,
      })
    );

    expect(screen.getByLabelText("Recolher menu")).toBeTruthy();
    expect(screen.getByLabelText("Navegação principal").props.style).toEqual(
      expect.objectContaining({ width: 88 })
    );
    expect(screen.getByTestId("web-sidebar-expanded-panel").props.style).toEqual(
      expect.objectContaining({ width: 220, position: "fixed" })
    );

    fireEvent.press(screen.getByLabelText("Recolher menu"));

    expect(screen.getByLabelText("Navegação principal compacta")).toBeTruthy();
    expect(screen.getByLabelText("Expandir menu")).toBeTruthy();
    expect(window.localStorage.setItem).toHaveBeenLastCalledWith(
      "goatleta:web-sidebar-expanded",
      "compact"
    );

    fireEvent.press(screen.getByLabelText("Expandir menu"));

    expect(screen.getByLabelText("Recolher menu")).toBeTruthy();
    expect(window.localStorage.setItem).toHaveBeenLastCalledWith(
      "goatleta:web-sidebar-expanded",
      "expanded"
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
    expect(screen.getByTestId("web-sidebar-expanded-panel").props.style).toEqual(
      expect.objectContaining({
        height: "100vh",
        maxHeight: "100dvh",
      })
    );
    expect(screen.getByLabelText("Abrir menu de perfil")).toBeTruthy();
    expect(screen.queryByLabelText("Navegação principal compacta")).toBeNull();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText("Hoje"));

    expect(screen.queryByLabelText("Fechar menu lateral")).toBeNull();
    expect(screen.queryByLabelText("Recolher menu")).toBeNull();
  });
});
