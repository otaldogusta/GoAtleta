import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "./app-theme";
import { ModalSheet } from "./ModalSheet";
import { Pressable } from "./Pressable";

type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: "default" | "danger";
  onConfirm: () => void | Promise<void>;
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => void;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);
const DEFAULT_CONFIRM_OPTIONS = {
  title: "Confirmar",
  message: "Deseja continuar?",
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
  tone: "default" as const,
};

function normalizeConfirmOptions(
  options: ConfirmDialogOptions | null
): typeof DEFAULT_CONFIRM_OPTIONS {
  if (!options) return DEFAULT_CONFIRM_OPTIONS;
  return {
    title:
      typeof options.title === "string" && options.title.trim()
        ? options.title
        : DEFAULT_CONFIRM_OPTIONS.title,
    message:
      typeof options.message === "string" && options.message.trim()
        ? options.message
        : DEFAULT_CONFIRM_OPTIONS.message,
    confirmLabel:
      typeof options.confirmLabel === "string" && options.confirmLabel.trim()
        ? options.confirmLabel
        : DEFAULT_CONFIRM_OPTIONS.confirmLabel,
    cancelLabel:
      typeof options.cancelLabel === "string" && options.cancelLabel.trim()
        ? options.cancelLabel
        : DEFAULT_CONFIRM_OPTIONS.cancelLabel,
    tone: options.tone === "danger" ? "danger" : "default",
  };
}

export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const confirm = useCallback((next: ConfirmDialogOptions) => {
    setOptions(next);
    setDialogKey((current) => current + 1);
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

  const dangerMatch = /(excluir|remover|revogar|apagar|deletar|desvincular)/i;
  const currentOptions = normalizeConfirmOptions(options);
  const isDanger =
    currentOptions.tone === "danger" ||
    dangerMatch.test(currentOptions.title) ||
    dangerMatch.test(currentOptions.confirmLabel);

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}
      {options ? (
        <ModalSheet
          key={dialogKey}
          visible
          onClose={() => setOptions(null)}
          position="center"
          overlayZIndex={30000}
          backdropOpacity={0.7}
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
              {currentOptions.title}
            </Text>
            <Text style={{ color: colors.muted }}>
              {currentOptions.message}
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
                {currentOptions.cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: isDanger ? colors.dangerSolidBg : colors.primaryBg,
              }}
            >
              <Text
                style={{
                  color: isDanger ? colors.dangerSolidText : colors.primaryText,
                  fontWeight: "700",
                }}
              >
                {currentOptions.confirmLabel}
              </Text>
            </Pressable>
          </View>
        </ModalSheet>
      ) : null}
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
