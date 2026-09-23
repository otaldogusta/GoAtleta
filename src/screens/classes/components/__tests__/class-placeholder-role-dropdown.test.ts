import { readFileSync } from "fs";
import { resolve } from "path";

it("uses the shared anchored dropdown for placeholder staff roles", () => {
  const source = readFileSync(resolve(process.cwd(), "src/screens/classes/components/ClassEditModalBody.tsx"), "utf8");

  expect(source).toContain("placeholderRoleTriggerRef.current?.measureInWindow");
  expect(source).toContain("visible={showPlaceholderRoleOptions && Boolean(placeholderRoleMenuLayout)}");
  expect(source).toContain("interactiveRefs={[placeholderRoleTriggerRef]}");
  expect(source).toContain("portalToBodyOnWeb");
  expect(source).not.toContain("showPlaceholderRoleOptions ? <View style={{ flexDirection: \"row\", flexWrap: \"wrap\"");
});

it("gives the floating list priority over the modal when Escape is pressed", () => {
  const source = readFileSync(resolve(process.cwd(), "src/ui/AnchoredDropdown.tsx"), "utf8");

  expect(source).toContain("event.stopImmediatePropagation()");
  expect(source).toContain('document.addEventListener("keydown", handleKeyDown, true)');
});
