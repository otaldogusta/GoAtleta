import { useEffect, useRef, useState } from "react";

type UseSingleAccordionOptions = {
  switchDelayMs?: number;
};

export function useSingleAccordion(
  initialExpandedKey: string | null,
  options: UseSingleAccordionOptions = {}
) {
  const { switchDelayMs = 220 } = options;
  const [expandedKey, setExpandedKey] = useState<string | null>(initialExpandedKey);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (expandedKey !== null || pendingKey === null) return;

    transitionTimerRef.current = setTimeout(() => {
      setExpandedKey(pendingKey);
      setPendingKey(null);
    }, switchDelayMs);

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, [expandedKey, pendingKey, switchDelayMs]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    },
    []
  );

  const toggle = (key: string) => {
    if (expandedKey === key) {
      setPendingKey(null);
      setExpandedKey(null);
      return;
    }

    if (expandedKey) {
      setPendingKey(key);
      setExpandedKey(null);
      return;
    }

    setExpandedKey(key);
  };

  return {
    expandedKey,
    setExpandedKey,
    pendingKey,
    toggle,
  };
}
