import { resolveHomeFloatingNoticeBottom } from "../home-floating-notice-layout";

describe("resolveHomeFloatingNoticeBottom", () => {
  it("reserves the mobile bottom navigation and safe area", () => {
    expect(resolveHomeFloatingNoticeBottom({ isMobile: true, safeAreaBottom: 0 })).toBe(104);
    expect(resolveHomeFloatingNoticeBottom({ isMobile: true, safeAreaBottom: 24 })).toBe(128);
  });

  it("keeps the compact desktop offset", () => {
    expect(resolveHomeFloatingNoticeBottom({ isMobile: false, safeAreaBottom: 24 })).toBe(20);
  });

  it("does not allow an invalid negative safe area to reduce the clearance", () => {
    expect(resolveHomeFloatingNoticeBottom({ isMobile: true, safeAreaBottom: -20 })).toBe(104);
  });
});
