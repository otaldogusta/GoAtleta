import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState } from "react";
import { Text, View } from "react-native";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { ModalSheet } from "./ModalSheet";

type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => void;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);

  const confirm = useCallback((next: ConfirmDialogOptions) => {
    setOptions(next);
  }, []);

  const handleConfirm = useCallback(() => {
    const current = options;
    setOptions(null);
    if (!current) return;
    void current.onConfirm();
  }, [options]);

  const contextValue = useMemo(
    () => ({
      confirm,
    }),
    [confirm]
  );

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}
      <ModalSheet
        visible={!!options}
        onClose={() => setOptions(null)}
        position="center"
        overlayZIndex={9999}
        cardStyle={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 18,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 12,
        }}
      >
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                {options?.title ?? "Confirmar"}
              </Text>
              <Text style={{ color: colors.muted }}>
                {options?.message ?? "Deseja continuar?"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
              <Pressable
                onPress={() => setOptions(null)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.secondaryText, fontWeight: "700" }}>
                  {options?.cancelLabel ?? "Cancelar"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  {options?.confirmLabel ?? "Confirmar"}
                </Text>
              </Pressable>
            </View>
      </ModalSheet>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    return {
      confirm: () => {},
    };
  }
  return context;
}
