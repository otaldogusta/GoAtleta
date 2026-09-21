import { fireEvent, render } from "@testing-library/react-native";
import { createElement } from "react";
import { AssistantMessages } from "../components/AssistantMessages";

jest.mock("../../ui/app-theme", () => ({
  useAppTheme: () => ({
    colors: {
      text: "#111827",
      primaryText: "#ffffff",
      primaryBg: "#0f172a",
      background: "#ffffff",
      border: "#e5e7eb",
      muted: "#64748b",
    },
  }),
}));

describe("AssistantMessages", () => {
  it("opens the exact saved class report from the inline class link", () => {
    const onOpenReport = jest.fn();
    const reportLink = {
      classId: "class-estrelas",
      className: "Estrelas do Saque",
      sessionDate: "2026-09-19",
    };

    const screen = render(createElement(AssistantMessages, {
      messages: [{
        role: "assistant" as const,
        content: "Relatório da **Estrelas do Saque** salvo em 19/09/2026.",
        reportLink,
      }],
      onOpenReport,
    }));

    fireEvent.press(screen.getByLabelText("Abrir relatório da turma Estrelas do Saque"));

    expect(onOpenReport).toHaveBeenCalledWith(reportLink);
    expect(screen.getByText("Estrelas do Saque")).toBeTruthy();
  });

  it("resolves an existing saved confirmation that predates structured link metadata", () => {
    const onOpenReport = jest.fn();
    const reportLink = {
      classId: "class-estrelas",
      className: "Estrelas do Saque",
      sessionDate: "2026-09-19",
    };
    const resolveReportLink = jest.fn(() => reportLink);

    const screen = render(createElement(AssistantMessages, {
      messages: [{
        role: "assistant" as const,
        content: "Relatório da **Estrelas do Saque** salvo em 19/09/2026.",
      }],
      onOpenReport,
      resolveReportLink,
    }));

    fireEvent.press(screen.getByLabelText("Abrir relatório da turma Estrelas do Saque"));

    expect(resolveReportLink).toHaveBeenCalled();
    expect(onOpenReport).toHaveBeenCalledWith(reportLink);
  });

  it("shows an existing-report result inline instead of leaving a silent save card", () => {
    const onOpenReport = jest.fn();
    const reportLink = {
      classId: "class-estrelas",
      className: "Estrelas do Saque",
      sessionDate: "2026-09-19",
      leadingText: "O relatório da ",
      trailingText: " em 19/09/2026 já existe. Abra para revisar.",
    };
    const screen = render(createElement(AssistantMessages, {
      messages: [{
        role: "assistant" as const,
        content: "O relatório da **Estrelas do Saque** em 19/09/2026 já existe. Abra para revisar.",
        reportLink,
      }],
      onOpenReport,
    }));

    expect(screen.getByText(/já existe\. Abra para revisar/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Abrir relatório da turma Estrelas do Saque"));
    expect(onOpenReport).toHaveBeenCalledWith(reportLink);
  });
});
