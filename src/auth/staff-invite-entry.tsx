import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "expo-router";
import { Platform } from "react-native";
import { parseStaffInviteFragment, type StaffInviteProof } from "./staff-invite-link";

const EntryContext = createContext<{
  proof: StaffInviteProof | null;
  clear: () => void;
}>({ proof: null, clear: () => {} });

const readProof = () => Platform.OS === "web" && typeof window !== "undefined" &&
  window.location.pathname === "/staff-invite"
  ? parseStaffInviteFragment(window.location.hash) : null;

// Above bootstrap/session gates: cleaning the URL must not erase the proof
// when those gates temporarily unmount the invitation screen. Memory only.
export function StaffInviteEntryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entry, setEntry] = useState(() => ({ pathname, proof: readProof() }));
  if (entry.pathname !== pathname) {
    setEntry({ pathname, proof: pathname === "/staff-invite" ? readProof() : null });
  }
  return <EntryContext.Provider value={{
    proof: entry.proof,
    clear: () => setEntry((current) => ({ ...current, proof: null })),
  }}>
    {children}
  </EntryContext.Provider>;
}

export const useStaffInviteEntry = () => useContext(EntryContext);
