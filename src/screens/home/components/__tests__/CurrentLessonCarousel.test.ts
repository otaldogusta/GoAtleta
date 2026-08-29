import fs from "node:fs";
import path from "node:path";

import {
  resolveCarouselIndex,
  resolveKeyboardCarouselIndex,
  shouldAnimateCarouselSync,
} from "../CurrentLessonCarousel";
import {
  createHorizontalGestureArbitrator,
  resolveDominantGestureAxis,
} from "../horizontal-gesture-arbitration";

const carouselSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/screens/home/components/CurrentLessonCarousel.tsx"),
  "utf8"
);
const weekDaySelectorSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/screens/home/components/WeekDaySelector.tsx"),
  "utf8"
);
const homeSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/screens/home/HomeProfessor.tsx"),
  "utf8"
);

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

describe("home horizontal gesture refresh contract", () => {
  it("classifies only a predominant gesture after the small movement threshold", () => {
    expect(resolveDominantGestureAxis(3, 1)).toBeNull();
    expect(resolveDominantGestureAxis(7, 2)).toBe("horizontal");
    expect(resolveDominantGestureAxis(2, 7)).toBe("vertical");
    expect(resolveDominantGestureAxis(7, 7)).toBeNull();
  });

  it("locks refresh only after a horizontal move and releases it at touch end", () => {
    const changes: boolean[] = [];
    const arbitrator = createHorizontalGestureArbitrator((active) => {
      changes.push(active);
    });

    arbitrator.start(100, 100);
    arbitrator.move(103, 101);
    expect(changes).toEqual([]);

    arbitrator.move(108, 102);
    expect(changes).toEqual([true]);

    arbitrator.end();
    expect(changes).toEqual([true, false]);
  });

  it("keeps pull-to-refresh enabled for a vertical gesture started on a rail", () => {
    const changes: boolean[] = [];
    const arbitrator = createHorizontalGestureArbitrator((active) => {
      changes.push(active);
    });

    arbitrator.start(100, 100);
    expect(changes).toEqual([]);
    arbitrator.move(102, 108);
    arbitrator.move(120, 110);
    arbitrator.end();

    expect(changes).toEqual([]);
  });

  it("uses arbitration on every horizontal rail instead of locking on touch start", () => {
    expect(carouselSource).toContain("resolveDominantGestureAxis(");
    expect(carouselSource).not.toContain(
      "onTouchStart={() => onHorizontalGestureChange?.(true)}"
    );
    expect(weekDaySelectorSource).toContain(
      "useHorizontalGestureArbitration("
    );
    expect(homeSource).toContain("useHorizontalGestureArbitration(");
    expect(homeSource).toContain("enabled={!horizontalGestureActive}");
  });

  it("refreshes home data without checking or reloading an EAS update", () => {
    expect(homeSource).toContain("await refreshHomeData()");
    expect(homeSource).not.toContain("checkForUpdateAsync");
    expect(homeSource).not.toContain("fetchUpdateAsync");
    expect(homeSource).not.toContain("Updates.reloadAsync");
  });
});
