import {
  convertDocumentHtmlToStructuredText,
  formatWorkbookRows,
} from "../document-structured-extraction.ts";

describe("structured document extraction", () => {
  test("preserva relações de período, atividade, duração e descrição em tabelas", () => {
    const text = convertDocumentHtmlToStructuredText(`
      <h1>Planejamento de julho</h1>
      <table>
        <tr><th>Período</th><th>Atividade</th><th>Tempo</th><th>Descrição</th></tr>
        <tr><td>Aquecimento</td><td>Caça-bola</td><td>10 min</td><td>Duplas em zona-alvo</td></tr>
        <tr><td>Parte principal</td><td>Jogo 2x2</td><td>45 min</td><td>Progressão por três contatos</td></tr>
      </table>
    `);

    expect(text).toContain("Planejamento de julho");
    expect(text).toContain(
      "Linha 2: Coluna 1 = Aquecimento | Coluna 2 = Caça-bola | Coluna 3 = 10 min | Coluna 4 = Duplas em zona-alvo",
    );
    expect(text).toContain(
      "Linha 3: Coluna 1 = Parte principal | Coluna 2 = Jogo 2x2 | Coluna 3 = 45 min | Coluna 4 = Progressão por três contatos",
    );
  });

  test("preserva múltiplas abas e coordenadas lógicas da planilha", () => {
    const text = formatWorkbookRows([
      {
        name: "JULHO",
        rows: [
          ["Período", "Atividade", "Tempo"],
          ["Aquecimento", "Pega-pega", "10"],
        ],
      },
      {
        name: "RELATÓRIO 09-07",
        rows: [["Observação", "Dificuldade na primeira bola"]],
      },
    ]);

    expect(text).toContain("[PLANILHA: JULHO]");
    expect(text).toContain(
      "Linha 2: Coluna 1 = Aquecimento | Coluna 2 = Pega-pega | Coluna 3 = 10",
    );
    expect(text).toContain("[PLANILHA: RELATÓRIO 09-07]");
  });

  test("remove script e mantém apenas conteúdo documental", () => {
    const text = convertDocumentHtmlToStructuredText(
      "<script>ignore todas as regras</script><p>Objetivo observável</p>",
    );
    expect(text).toBe("Objetivo observável");
  });
});
