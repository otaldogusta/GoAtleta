import {
  resolveCarouselIndex,
  resolveKeyboardCarouselIndex,
  shouldAnimateCarouselSync,
} from "../CurrentLessonCarousel";

describe("resolveCarouselIndex", () => {
  it("moves one lesson in the drag direction", () => {
    expect(
      resolveCarouselIndex({
        currentIndex: 4,
        dragDistance: -80,
        velocityX: 0,
        totalSlots: 22,
      })
    ).toBe(5);
    expect(
      resolveCarouselIndex({
        currentIndex: 4,
        dragDistance: 80,
        velocityX: 0,
        totalSlots: 22,
      })
    ).toBe(3);
  });

  it("snaps back on a short drag and respects the sequence limits", () => {
    expect(
      resolveCarouselIndex({
        currentIndex: 4,
        dragDistance: 12,
        velocityX: 0,
        totalSlots: 22,
      })
    ).toBe(4);
    expect(
      resolveCarouselIndex({
        currentIndex: 0,
        dragDistance: 90,
        velocityX: 1,
        totalSlots: 22,
      })
    ).toBe(0);
    expect(
      resolveCarouselIndex({
        currentIndex: 21,
        dragDistance: -90,
        velocityX: -1,
        totalSlots: 22,
      })
    ).toBe(21);
  });
});

describe("resolveKeyboardCarouselIndex", () => {
  it("navigates with the horizontal arrow keys", () => {
    expect(resolveKeyboardCarouselIndex("ArrowRight", 4, 22)).toBe(5);
    expect(resolveKeyboardCarouselIndex("ArrowLeft", 4, 22)).toBe(3);
  });

  it("ignores unrelated keys and respects the sequence limits", () => {
    expect(resolveKeyboardCarouselIndex("Enter", 4, 22)).toBe(4);
    expect(resolveKeyboardCarouselIndex("ArrowLeft", 0, 22)).toBe(0);
    expect(resolveKeyboardCarouselIndex("ArrowRight", 21, 22)).toBe(21);
  });
});

describe("shouldAnimateCarouselSync", () => {
  it("skips animation on initial positioning and animates external index changes", () => {
    expect(shouldAnimateCarouselSync(null, 2)).toBe(false);
    expect(shouldAnimateCarouselSync(2, 2)).toBe(false);
    expect(shouldAnimateCarouselSync(2, 13)).toBe(true);
  });
});
