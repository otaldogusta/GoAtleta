import { createContext, useContext } from "react";

export type NativeSidebarController = {
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
};

const noop = () => undefined;

export const NativeSidebarControllerContext = createContext<NativeSidebarController>({
  openMobileSidebar: noop,
  closeMobileSidebar: noop,
});

export function useNativeSidebarController() {
  return useContext(NativeSidebarControllerContext);
}
