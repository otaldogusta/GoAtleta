import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import type { OrganizationInvoice } from "../../../../api/finance";
import type { ThemeColors } from "../../../../ui/app-theme";
import { formatMoneyFromCents } from "../../../../finance/application/finance-format";
import {
  deriveStudentFinanceIndicator,
  deriveStudentFinanceSummary,
  LOADING_FINANCE_INDICATOR,
  UNAVAILABLE_FINANCE_INDICATOR,
} from "../../application/student-operational-indicators";
import { StudentFinanceSummaryPopover } from "../StudentFinanceSummaryPopover";

jest.mock("../../../../ui/AnchoredDropdown", () => ({
  AnchoredDropdown: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
jest.mock("../../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));

const colors = { text: "#fff", muted: "#bbb", border: "#777", secondaryBg: "#123", dangerText: "#f99" } as ThemeColors;
const now = new Date("2026-09-03T12:00:00");
const invoice: OrganizationInvoice = {
  id: "test-invoice", studentId: "test-student", studentName: "Atleta Teste",
  competenceMonth: "2026-09", dueDate: "2026-09-02", amountCents: 16000,
  paidCents: 6000, status: "partially_paid", description: "Mensalidade setembro",
  createdAt: "2026-09-01T12:00:00Z", paidAt: null,
};
const baseProps = {
  visible: true, layout: { x: 200, y: 120, width: 210, height: 62 },
  triggerRef: { current: null }, colors, onClose: jest.fn(), onOpenFinance: jest.fn(),
  summary: deriveStudentFinanceSummary([], now),
  indicator: deriveStudentFinanceIndicator([], now),
};

describe("student finance summary popover", () => {
  beforeEach(() => jest.clearAllMocks());

  it("distinguishes loading, unavailable and an actually empty history", () => {
    const view = render(React.createElement(StudentFinanceSummaryPopover, {
      ...baseProps, summary: null, indicator: LOADING_FINANCE_INDICATOR,
    }));
    expect(view.getByText("Consultando cobranças")).toBeTruthy();
    expect(view.queryByText("Nenhuma cobrança para este aluno.")).toBeNull();
    view.rerender(React.createElement(StudentFinanceSummaryPopover, {
      ...baseProps, summary: null, indicator: UNAVAILABLE_FINANCE_INDICATOR,
    }));
    expect(view.getByText("Não foi possível consultar as cobranças")).toBeTruthy();
    view.rerender(React.createElement(StudentFinanceSummaryPopover, baseProps));
    expect(view.getByText("Nenhuma cobrança para este aluno.")).toBeTruthy();
  });

  it("renders the derived real balance and invoice without editable financial fields", () => {
    const view = render(React.createElement(StudentFinanceSummaryPopover, {
      ...baseProps, summary: deriveStudentFinanceSummary([invoice], now),
      indicator: deriveStudentFinanceIndicator([invoice], now),
    }));
    expect(view.getByText("Saldo em aberto")).toBeTruthy();
    expect(view.getAllByText(formatMoneyFromCents(10000))).toHaveLength(2);
    expect(view.getByText(formatMoneyFromCents(16000))).toBeTruthy();
    expect(view.getByText("Mensalidade setembro")).toBeTruthy();
    expect(view.queryByText("Última quitação")).toBeNull();
    expect(view.queryAllByRole("adjustable")).toHaveLength(0);
  });

  it("only navigates when the explicit full-finance action is pressed", () => {
    const view = render(React.createElement(StudentFinanceSummaryPopover, baseProps));
    expect(baseProps.onOpenFinance).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText("Abrir financeiro completo do aluno"));
    expect(baseProps.onOpenFinance).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByLabelText("Fechar resumo financeiro"));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render the summary when dismissed", () => {
    const view = render(React.createElement(StudentFinanceSummaryPopover, { ...baseProps, visible: false }));
    expect(view.queryByLabelText("Resumo financeiro do aluno")).toBeNull();
  });
});
