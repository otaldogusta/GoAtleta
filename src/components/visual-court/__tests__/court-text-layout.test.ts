import { hitCourtText, measureCourtText } from "../court-text-layout";

describe("court annotation geometry", () => {
  const anchor = { x: 300, y: 200 };
  it("measures wide and narrow characters differently", () => {
    expect(measureCourtText("WWW", 32)).toBeGreaterThan(measureCourtText("iii", 32));
  });
  it("selects both ends of a long annotation without capturing the empty court", () => {
    const text = "Cobertura do bloqueio pela linha";
    const half = measureCourtText(text, 32) / 2;
    expect(hitCourtText({ x: anchor.x + half - 1, y: 190 }, anchor, text, 32, 0, 4)).toBe(true);
    expect(hitCourtText({ x: anchor.x - half + 1, y: 190 }, anchor, text, 32, 0, 4)).toBe(true);
    expect(hitCourtText({ x: anchor.x + half + 20, y: 190 }, anchor, text, 32, 0, 4)).toBe(false);
  });
  it("rotates the hit area around the text anchor", () => {
    const text = "Texto vertical longo";
    expect(hitCourtText({ x: 310, y: 270 }, anchor, text, 32, 90, 4)).toBe(true);
    expect(hitCourtText({ x: 370, y: 190 }, anchor, text, 32, 90, 4)).toBe(false);
  });
});
