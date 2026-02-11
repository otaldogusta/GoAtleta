import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "./app-theme";
import { ModalSheet } from "./ModalSheet";
import { Pressable } from "./Pressable";

type ConfirmUndoOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  undoLabel: string;
  undoMessage: string;
  delayMs: number;
  onConfirm: () => void | Promise<void>;
  onOptimistic: () => void;
  onUndo: () => void | Promise<void>;
};

type PendingState = {
  options: ConfirmUndoOptions;
  timeoutId: ReturnType<typeof setTimeout>;
};

type ConfirmUndoContextValue = {
  confirm: (options: ConfirmUndoOptions) => void;
};

const ConfirmUndoContext = createContext<ConfirmUndoContextValue | null>(null);

export function ConfirmUndoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const [confirmOptions, setConfirmOptions] = useState<ConfirmUndoOptions | null>(null);
  const [pending, setPending] = useState<PendingState | null>(null);

  useEffect(() => {
    return () => {
      if (pending) {
        clearTimeout(pending.timeoutId);
      }
    };
  }, [pending]);

  const commitPending = useCallback(async (current: PendingState) => {
    clearTimeout(current.timeoutId);
    setPending(null);
    try {
      await current.options.onConfirm();
    } catch {
      // Ignore to avoid unhandled rejection in global handler.
    }
  }, []);

  const confirm = useCallback(
    (options: ConfirmUndoOptions) => {
      if (pending) {
        void commitPending(pending);
      }
      setConfirmOptions(options);
    },
    [commitPending, pending]
  );

  const handleConfirm = useCallback(() => {
    const options = confirmOptions;
    setConfirmOptions(null);
    if (!options) return;
    options.onOptimistic();
    const delay = options.delayMs ?? 4500;
    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          await options.onConfirm();
        } catch {
          // Ignore to avoid unhandled rejection in global handler.
        } finally {
          setPending(null);
        }
      })();
    }, delay);
    setPending({ options, timeoutId });
  }, [confirmOptions]);

  const handleUndo = useCallback(async () => {
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    setPending(null);
    await pending.options.onUndo();
  }, [pending]);

  const modalTitle = confirmOptions?.title ?? "Confirmar";
  const modalMessage =
    confirmOptions?.message ?? "Deseja continuar com esta ação?";
  const confirmLabel = confirmOptions?.confirmLabel ?? "Excluir";
  const cancelLabel = confirmOptions?.cancelLabel ?? "Cancelar";
  const undoLabel = pending?.options.undoLabel ?? "Desfazer";
  const undoMessage =
    pending?.options.undoMessage ?? "Ação concluída. Deseja desfazer?";

  const contextValue = useMemo(
    () => ({
      confirm,
    }),
    [confirm]
  );

  return (
    <ConfirmUndoContext.Provider value={contextValue}>
      {children}
      <ModalSheet
        visible={!!confirmOptions}
        onClose={() => setConfirmOptions(null)}
        position="center"
        overlayZIndex={19000}
        cardStyle={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 18,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 12,
        }}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            {modalTitle}
          </Text>
          <Text style={{ color: colors.muted }}>{modalMessage}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Você poderá desfazer por alguns segundos.
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
          <Pressable
            onPress={() => setConfirmOptions(null)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ color: colors.secondaryText, fontWeight: "700" }}>
              {cancelLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.dangerSolidBg,
            }}
          >
            <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
      {pending ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 24,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>
            {undoMessage}
          </Text>
          <Pressable
            onPress={handleUndo}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.primaryBg,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              {undoLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ConfirmUndoContext.Provider>
  );
}

export function useConfirmUndo() {
  const context = useContext(ConfirmUndoContext);
  if (!context) {
    return {
      confirm: () => {},
    };
  }
  return context;
}
