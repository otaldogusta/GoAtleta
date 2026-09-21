import { resolveClassMemoryProposal } from "../class-memory-proposal";

describe("resolveClassMemoryProposal", () => {
  const classes = [{ id: "class-1", name: "Estrelas do Saque" }];

  it("builds a scoped proposal for a recurring class rule", () => {
    expect(resolveClassMemoryProposal({
      draft: { className: "estrelas do saque", summary: "A última aula do mês é reservada apenas para jogos.", confidence: "high" },
      classes,
      proposalId: "proposal-1",
      sourceText: "Toda última aula do mês é apenas joguinho.",
    })).toMatchObject({ classId: "class-1", confidence: "high" });
  });

  it("does not turn a one-off report detail into durable memory", () => {
    expect(resolveClassMemoryProposal({
      draft: { className: "Estrelas do Saque", summary: "Hoje fizemos jogo 4x4." },
      classes,
      proposalId: "proposal-2",
      sourceText: "Hoje fizemos jogo 4x4.",
    })).toBeNull();
  });
});
