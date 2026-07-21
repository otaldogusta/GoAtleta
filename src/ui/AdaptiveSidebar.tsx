import { Platform } from "react-native";

import type { AppRole } from "../components/navigation/tab-config";
import { NativeSidebar } from "./NativeSidebar";
import { WebSidebar } from "./WebSidebar";

type AdaptiveSidebarProps = {
  role: AppRole;
  canExpand: boolean;
};

export function AdaptiveSidebar({ role, canExpand }: AdaptiveSidebarProps) {
  return Platform.OS === "web" ? (
    <WebSidebar role={role} canExpand={canExpand} />
  ) : (
    <NativeSidebar role={role} canExpand={canExpand} />
  );
}
