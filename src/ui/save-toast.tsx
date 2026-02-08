import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { getFriendlyErrorMessage } from "./error-messages";

type SaveToastOptions = {
  message?: string;
  error?: unknown;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  variant?: "info" | "success" | "error" | "warning";
};

type SaveToastContextValue = {
  showSaveToast: (options: SaveToastOptions | string) => void;
};

const SaveToastContext = createContext<SaveToastContextValue | null>(null);

export function SaveToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<SaveToastOptions | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setToast(null);
    });
  }, [anim]);

  const showSaveToast = useCallback(
    (options: SaveToastOptions | string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const normalized: SaveToastOptions =
        typeof options === "string" ? { message: options } : options;
      const variant =
        normalized.variant ?? (normalized.error ? "error" : "info");
      const message = normalized.error
        ? getFriendlyErrorMessage(normalized.error)
        : normalized.message ?? "Concluído.";
      setToast({ ...normalized, message, variant });
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      const duration = normalized.durationMs ?? 2800;
      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [anim, hideToast]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const value = useMemo(() => ({ showSaveToast }), [showSaveToast]);

  const variant = toast?.variant ?? "info";
  const backgroundColor =
    variant === "success"
      ? colors.successBg
      : variant === "warning"
      ? colors.warningBg
      : variant === "error"
      ? colors.dangerBg
      : colors.card;
  const borderColor =
    variant === "success"
      ? colors.successBg
      : variant === "warning"
      ? colors.warningBg
      : variant === "error"
      ? colors.dangerBorder
      : colors.border;
  const textColor =
    variant === "success"
      ? colors.successText
      : variant === "warning"
      ? colors.warningText
      : variant === "error"
      ? colors.dangerText
      : colors.text;

  return (
    <SaveToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: Math.max(16, insets.bottom + 8),
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor,
              borderWidth: 1,
              borderColor,
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
            <Text style={{ color: textColor, fontWeight: "600", flex: 1, fontSize: 13 }}>
              {toast.message}
            </Text>
            {toast.actionLabel ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  hideToast();
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                  {toast.actionLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </SaveToastContext.Provider>
  );
}

export function useSaveToast() {
  const context = useContext(SaveToastContext);
  if (!context) {
    return { showSaveToast: () => {} };
  }
  return context;
}

