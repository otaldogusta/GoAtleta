import { useSyncExternalStore } from "react";

let openModalSheetCount = 0;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const incrementModalSheetOpenCount = () => {
  openModalSheetCount += 1;
  notify();
};

export const decrementModalSheetOpenCount = () => {
  openModalSheetCount = Math.max(0, openModalSheetCount - 1);
  notify();
};

export const subscribeModalSheetVisibility = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getModalSheetOpenCountSnapshot = () => openModalSheetCount;

export const useModalSheetOpen = () => {
  const count = useSyncExternalStore(
    subscribeModalSheetVisibility,
    getModalSheetOpenCountSnapshot,
    getModalSheetOpenCountSnapshot
  );
  return count > 0;
};

