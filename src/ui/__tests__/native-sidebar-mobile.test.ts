import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { NativeSidebar } from "../NativeSidebar";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockSignOut = jest.fn();

jest.mock("expo-router", () => ({
  usePathname: () => "/prof",
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../auth/auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1", email: "prof@example.com" } },
    signOut: mockSignOut,
  }),
}));

jest.mock("../../providers/OrganizationProvider", () => ({
  useOptionalOrganization: () => ({
    activeOrganization: { role_level: 50 },
    memberPermissions: {},
    permissionsLoading: false,
  }),
}));

jest.mock("../GoAtletaBrand", () => ({
  GoAtletaBrandMark: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("GoAtletaBrandMark", props);
  },
  GoAtletaBrandWordmark: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("GoAtletaBrandWordmark", props);
  },
}));

jest.mock("../icon-registry", () => ({
  GoAtletaIcon: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("GoAtletaIcon", props);
  },
}));

const appShell = readFileSync(resolve(__dirname, "../AppShell.tsx"), "utf8");
const nativeSidebar = readFileSync(resolve(__dirname, "../NativeSidebar.tsx"), "utf8");
const homeProfessor = readFileSync(
  resolve(__dirname, "../../screens/home/HomeProfessor.tsx"),
  "utf8"
);

describe("native mobile sidebar", () => {
  it("exposes the same Home menu trigger on native mobile", () => {
    expect(homeProfessor).toContain("{responsiveLayout.isMobile ? (");
    expect(homeProfessor).toContain("openMobileSidebar();");
    expect(homeProfessor).toContain('accessibilityLabel="Abrir menu principal"');
  });

  it("keeps an expanded, dismissible native drawer mounted for a stable animation", () => {
    expect(appShell).toContain('Platform.OS !== "web" && !layout.usesWorkspaceShell');
    expect(appShell).toContain("accessibilityViewIsModal");
    expect(appShell).toContain("forceExpanded");
    expect(appShell).toContain('BackHandler.addEventListener("hardwareBackPress"');
    expect(appShell).toContain("mobileSidebarProgress");
    expect(appShell).toContain("renderToHardwareTextureAndroid");
    expect(appShell).toContain('pointerEvents={mobileSidebarOpen ? "auto" : "none"}');
    expect(nativeSidebar).toContain('accessibilityLabel="Fechar menu principal"');
    expect(nativeSidebar).toContain("onNavigate?.();");
  });

  it("matches the web drawer branding and fixed profile footer", () => {
    expect(nativeSidebar).toContain("GoAtletaBrandMark");
    expect(nativeSidebar).toContain("GoAtletaBrandWordmark");
    expect(nativeSidebar).not.toContain(">GA</Text>");
    expect(nativeSidebar).toContain('accessibilityLabel="Menu de perfil"');
    expect(nativeSidebar).toContain("Perfil e configurações");
    expect(nativeSidebar).toContain('accessibilityLabel="Sair da conta"');
  });

  it("closes the profile popup whenever the mobile drawer closes", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(NativeSidebar, {
          role: "prof",
          visible: true,
          canExpand: false,
          forceExpanded: true,
          drawerOpen: true,
        }),
      );
    });

    act(() => {
      renderer!.root.findByProps({ accessibilityLabel: "Abrir menu de perfil" }).props.onPress();
    });
    expect(
      renderer!.root.findAllByProps({ accessibilityLabel: "Menu de perfil" }).length,
    ).toBeGreaterThan(0);

    act(() => {
      renderer!.update(
        React.createElement(NativeSidebar, {
          role: "prof",
          visible: true,
          canExpand: false,
          forceExpanded: true,
          drawerOpen: false,
        }),
      );
    });
    expect(renderer!.root.findAllByProps({ accessibilityLabel: "Menu de perfil" })).toHaveLength(0);
  });
});
