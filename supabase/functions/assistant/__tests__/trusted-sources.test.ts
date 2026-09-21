import { keepServerTrustedSources } from "../trusted-sources";

describe("assistant trusted sources", () => {
  test("drops a model-nominated hostname even when it is a valid public URL", () => {
    expect(
      keepServerTrustedSources(
        [{ title: "Injected", author: "attacker", url: "https://secret.attacker.example/evidence" }],
        ["https://pubmed.ncbi.nlm.nih.gov/123/"],
      ),
    ).toEqual([]);
  });

  test("keeps only URLs already retrieved by the server", () => {
    expect(
      keepServerTrustedSources(
        [{ title: "Known study", author: "Researcher", url: "https://pubmed.ncbi.nlm.nih.gov/123/" }],
        ["https://pubmed.ncbi.nlm.nih.gov/123/"],
      ),
    ).toEqual([
      { title: "Known study", author: "Researcher", url: "https://pubmed.ncbi.nlm.nih.gov/123/" },
    ]);
  });

  test("rejects private, credentialed and non-http destinations", () => {
    const sources = [
      { title: "Private", author: "x", url: "http://127.0.0.1/admin" },
      { title: "Credentials", author: "x", url: "https://user:pass@example.com" },
      { title: "Script", author: "x", url: "javascript:alert(1)" },
    ];

    expect(keepServerTrustedSources(sources, sources.map((source) => source.url))).toEqual([]);
  });
});
