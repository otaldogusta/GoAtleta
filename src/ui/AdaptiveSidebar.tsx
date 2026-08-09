import { Platform } from "react-native";

import type { AppRole } from "../components/navigation/tab-config";
import { NativeSidebar } from "./NativeSidebar";
import { WebSidebar } from "./WebSidebar";

type AdaptiveSidebarProps = {
  role: AppRole;
  showCompact: boolean;
  canExpand: boolean;
  canPersistExpansion: boolean;
};

export function AdaptiveSidebar({
  role,
  showCompact,
  canExpand,
  canPersistExpansion,
}: AdaptiveSidebarProps) {
  return Platform.OS === "web" ? (
    <WebSidebar
      role={role}
      showCompact={showCompact}
      canExpand={canExpand}
      canPersistExpansion={canPersistExpansion}
    />
  ) : (
    <NativeSidebar role={role} visible={showCompact} canExpand={canExpand} />
  );
}
