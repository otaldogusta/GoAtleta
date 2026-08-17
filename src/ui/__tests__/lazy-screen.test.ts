import { act, render, screen } from "@testing-library/react-native";
import { createElement } from "react";
import { Text } from "react-native";

import { createLazyRoute } from "../lazy-screen";

describe("createLazyRoute", () => {
  it("replaces the native fallback after the route module resolves", async () => {
    let resolveModule: ((value: { default: () => ReturnType<typeof createElement> }) => void) | undefined;
    const loader = jest.fn(
      () =>
        new Promise<{ default: () => ReturnType<typeof createElement> }>((resolve) => {
          resolveModule = resolve;
        })
    );
    const LoadedScreen = () => createElement(Text, null, "Conteúdo carregado");
    const Route = createLazyRoute(
      loader,
      createElement(Text, null, "Carregando rota")
    );

    render(createElement(Route));

    expect(screen.getByText("Carregando rota")).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveModule?.({ default: LoadedScreen });
      await Promise.resolve();
    });

    expect(screen.getByText("Conteúdo carregado")).toBeTruthy();
  });
});
