import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ConfirmUndoOptions } from "./confirm-undo";
import { useSaveToast } from "./save-toast";

type ItemId = string | number;
type TextFactory<T> = string | ((items: T[]) => string);

type RemovedItem<T, Id extends ItemId> = {
  id: Id;
  item: T;
  index: number;
};

export type UndoableListConfirm = (options: ConfirmUndoOptions) => void;

export type UseUndoableListDeleteParams<T, Id extends ItemId = string> = {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  getId: (item: T) => Id;
  confirm: UndoableListConfirm;
  deleteItems: (ids: Id[], items: T[]) => void | Promise<void>;
  title: TextFactory<T>;
  message: TextFactory<T>;
  confirmLabel?: string;
  cancelLabel?: string;
  undoLabel?: string;
  undoMessage: TextFactory<T>;
  delayMs?: number;
  onOptimistic?: (items: T[], ids: Id[]) => void;
  onConfirmed?: (items: T[], ids: Id[]) => void | Promise<void>;
  onError?: (error: unknown, items: T[], ids: Id[]) => void;
  reconcileAfterConfirm?: boolean;
  reconcile?: () => void | Promise<void>;
};

const resolveText = <T,>(factory: TextFactory<T>, items: T[]) =>
  typeof factory === "function" ? factory(items) : factory;

export function restoreUndoableListItems<T, Id extends ItemId>(
  currentItems: T[],
  removedItems: RemovedItem<T, Id>[],
  getId: (item: T) => Id
) {
  const result = [...currentItems];
  const presentIds = new Set(result.map(getId));

  for (const removed of [...removedItems].sort((a, b) => a.index - b.index)) {
    if (presentIds.has(removed.id)) continue;
    const insertAt = Math.max(0, Math.min(removed.index, result.length));
    result.splice(insertAt, 0, removed.item);
    presentIds.add(removed.id);
  }

  return result;
}

export function useUndoableListDelete<T, Id extends ItemId = string>({
  items,
  setItems,
  getId,
  confirm,
  deleteItems,
  title,
  message,
  confirmLabel = "Excluir",
  cancelLabel,
  undoLabel,
  undoMessage,
  delayMs,
  onOptimistic,
  onConfirmed,
  onError,
  reconcileAfterConfirm = false,
  reconcile,
}: UseUndoableListDeleteParams<T, Id>) {
  const { showSaveToast } = useSaveToast();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetItems = useCallback(
    (updater: SetStateAction<T[]>) => {
      if (!mountedRef.current) return;
      setItems(updater);
    },
    [setItems]
  );

  const restoreRemovedItems = useCallback(
    (removedItems: RemovedItem<T, Id>[]) => {
      safeSetItems((current) =>
        restoreUndoableListItems(current, removedItems, getId)
      );
    },
    [getId, safeSetItems]
  );

  const resolveTargets = useCallback(
    (targets: Array<T | Id>) => {
      const targetIds = new Set<Id>();

      for (const target of targets) {
        if (
          (typeof target === "string" || typeof target === "number") &&
          !items.some((item) => item === target)
        ) {
          targetIds.add(target as Id);
        } else {
          targetIds.add(getId(target as T));
        }
      }

      const removedItems: RemovedItem<T, Id>[] = [];
      items.forEach((item, index) => {
        const id = getId(item);
        if (targetIds.has(id)) {
          removedItems.push({ id, item, index });
        }
      });

      return removedItems;
    },
    [getId, items]
  );

  const deleteMany = useCallback(
    (targets: Array<T | Id>) => {
      const removedItems = resolveTargets(targets);
      if (!removedItems.length) return;

      const removedValues = removedItems.map((entry) => entry.item);
      const removedIds = removedItems.map((entry) => entry.id);
      const removedIdSet = new Set<Id>(removedIds);

      confirm({
        title: resolveText(title, removedValues),
        message: resolveText(message, removedValues),
        confirmLabel,
        cancelLabel,
        undoLabel,
        undoMessage: resolveText(undoMessage, removedValues),
        delayMs,
        onOptimistic: () => {
          safeSetItems((current) =>
            current.filter((item) => !removedIdSet.has(getId(item)))
          );
          onOptimistic?.(removedValues, removedIds);
        },
        onConfirm: async () => {
          try {
            await deleteItems(removedIds, removedValues);
            if (reconcileAfterConfirm) {
              await reconcile?.();
            }
            await onConfirmed?.(removedValues, removedIds);
          } catch (error) {
            restoreRemovedItems(removedItems);
            if (onError) {
              onError(error, removedValues, removedIds);
            } else {
              showSaveToast({ error, variant: "error" });
            }
          }
        },
        onUndo: async () => {
          restoreRemovedItems(removedItems);
        },
      });
    },
    [
      cancelLabel,
      confirm,
      confirmLabel,
      delayMs,
      deleteItems,
      getId,
      message,
      onConfirmed,
      onError,
      onOptimistic,
      reconcile,
      reconcileAfterConfirm,
      resolveTargets,
      restoreRemovedItems,
      safeSetItems,
      showSaveToast,
      title,
      undoLabel,
      undoMessage,
    ]
  );

  const deleteOne = useCallback(
    (target: T | Id) => {
      deleteMany([target]);
    },
    [deleteMany]
  );

  return {
    deleteOne,
    deleteMany,
  };
}
