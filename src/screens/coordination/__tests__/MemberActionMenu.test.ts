import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform, ScrollView } from "react-native";

import { MemberActionMenu } from "../CoordinationPeopleWorkspace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../ui/app-theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#111827",
      dangerText: "#f87171",
      text: "#f8fafc",
    },
  }),
}));

jest.mock("../../../auth/auth", () => ({
  useAuth: () => ({ session: null }),
}));

jest.mock("../../../ui/icon-registry", () => ({
  GoAtletaIcon: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("GoAtletaIcon", props);
  },
}));

jest.mock("../../../ui/AnchoredDropdown", () => ({
  AnchoredDropdown: ({ visible, children, ...props }: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement(
      "AnchoredDropdown",
      { ...props, visible },
      visible ? children : null
    );
  },
}));

jest.mock("../../../ui/AnchoredDropdownOption", () => ({
  AnchoredDropdownOption: ({ children, ...props }: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("AnchoredDropdownOption", props, children);
  },
}));

jest.mock("../../../ui/ModalSheet", () => ({
  ModalSheet: ({ visible, children, ...props }: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement(
      "ModalSheet",
      { ...props, visible },
      visible ? children : null
    );
  },
}));

const member = {
  userId: "user-1",
  displayName: "Ana Silva",
  roleLevel: 10,
} as never;

const setPlatform = (os: "android" | "web") => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os });
};

const renderMenu = (
  callbacks: {
    onEdit: jest.Mock;
    onMessage: jest.Mock;
    onDeactivate: jest.Mock;
  },
  viewportHeight = 844
) =>
  TestRenderer.create(
    React.createElement(MemberActionMenu, { member, viewportHeight, ...callbacks }),
    {
      createNodeMock: () => ({
        measureInWindow: (
          callback: (x: number, y: number, width: number, height: number) => void
        ) => callback(300, 24, 44, 44),
      }),
    }
  );

describe("MemberActionMenu", () => {
  const originalPlatform = Platform.OS;

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("opens accessible member actions in a native sheet", () => {
    setPlatform("android");
    const callbacks = {
      onEdit: jest.fn(),
      onMessage: jest.fn(),
      onDeactivate: jest.fn(),
    };
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = renderMenu(callbacks);
    });

    expect(renderer!.root.findAllByType("AnchoredDropdown")).toHaveLength(0);
    const trigger = renderer!.root.findByProps({ accessibilityLabel: "Ações de Ana Silva" });
    expect(trigger.props.accessibilityRole).toBe("button");

    act(() => trigger.props.onPress());

    const nativeSheet = renderer!.root.findByType("ModalSheet");
    expect(nativeSheet.props.visible).toBe(true);
    expect(typeof nativeSheet.props.cardStyle.maxHeight).toBe("number");
    expect(renderer!.root.findAllByType(ScrollView)).toHaveLength(1);
    const edit = renderer!.root.findByProps({
      accessibilityLabel: "Perfil e permissões de Ana Silva",
    });
    expect(edit.props.accessibilityRole).toBe("button");

    act(() => edit.props.onPress());
    expect(callbacks.onEdit).toHaveBeenCalledWith(member);
    expect(renderer!.root.findByType("ModalSheet").props.visible).toBe(false);
  });

  it("keeps the native sheet inside a short viewport", () => {
    setPlatform("android");
    const callbacks = {
      onEdit: jest.fn(),
      onMessage: jest.fn(),
      onDeactivate: jest.fn(),
    };
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = renderMenu(callbacks, 120);
    });
    act(() => {
      renderer!.root.findByProps({ accessibilityLabel: "Ações de Ana Silva" }).props.onPress();
    });

    expect(renderer!.root.findByType("ModalSheet").props.cardStyle.maxHeight).toBe(104);
  });

  it("keeps member actions in an anchored dropdown on web", () => {
    setPlatform("web");
    const callbacks = {
      onEdit: jest.fn(),
      onMessage: jest.fn(),
      onDeactivate: jest.fn(),
    };
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = renderMenu(callbacks);
    });

    expect(renderer!.root.findAllByType("ModalSheet")).toHaveLength(0);
    expect(renderer!.root.findByType("AnchoredDropdown").props).toEqual(
      expect.objectContaining({ visible: false, density: "compact", container: null })
    );
    expect(
      renderer!.root.findByProps({ accessibilityLabel: "Ações de Ana Silva" }).props
        .accessibilityRole
    ).toBe("button");
  });
});
