import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { ScientificEvidencePanel, type ScientificReference } from "../ScientificEvidencePanel";

jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));

const reference: ScientificReference = {
  id: "ref-1",
  title: "Representative learning design in youth volleyball",
  author: "Ana Example",
  url: "https://doi.org/10.1000/example.1",
  doi: "10.1000/example.1",
  pmid: "",
  year: "2025",
  method: "Estudo controlado",
  population: "Atletas adolescentes de voleibol",
  supportingExcerpt: "Tarefas representativas melhoraram a transferência.",
  limitations: ["Amostra de um único clube"],
};

const view = (status: "searched" | "quota_exceeded", onOpenReference = jest.fn()) => render(
  React.createElement(ScientificEvidencePanel, { references: [reference], status, onOpenReference })
);

describe("ScientificEvidencePanel", () => {
  test("keeps methodological details collapsed until the trainer expands a reference", () => {
    const open = jest.fn();
    const screen = view("searched", open);
    expect(screen.getByText("Base científica · 1 referência")).toBeTruthy();
    expect(screen.queryByText("Estudo controlado")).toBeNull();
    fireEvent.press(screen.getByLabelText(`Expandir referência ${reference.title}`));
    expect(screen.getByText("Estudo controlado")).toBeTruthy();
    expect(screen.getByText("Atletas adolescentes de voleibol")).toBeTruthy();
    expect(screen.getByText("Amostra de um único clube")).toBeTruthy();
    fireEvent.press(screen.getByText("Abrir referência"));
    expect(open).toHaveBeenCalledWith(reference.url);
  });

  test("explains quota fallback without exposing provider names", () => {
    const screen = view("quota_exceeded");
    expect(screen.getByText("A cota externa foi atingida; usamos cache ou fonte alternativa.")).toBeTruthy();
    expect(screen.queryByText(/Consensus|PubMed/i)).toBeNull();
  });
});
