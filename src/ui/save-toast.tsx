import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Platform, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
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
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    animationRef.current?.stop();
    const exitAnimation = Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    });
    animationRef.current = exitAnimation;
    exitAnimation.start(() => {
      setToast(null);
      animationRef.current = null;
    });
  }, [anim]);

  const showSaveToast = useCallback(
    (options: SaveToastOptions | string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      animationRef.current?.stop();
      const normalized: SaveToastOptions =
        typeof options === "string" ? { message: options } : options;
      const variant =
        normalized.variant ?? (normalized.error ? "error" : "info");
      const message = normalized.error
        ? getFriendlyErrorMessage(normalized.error)
        : normalized.message ?? "Concluído.";
      setToast({ ...normalized, message, variant });
      anim.setValue(0);
      const enterAnimation = Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      });
      animationRef.current = enterAnimation;
      enterAnimation.start(() => {
        animationRef.current = null;
      });
      const duration = normalized.durationMs ?? 2800;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        hideToast();
      }, duration);
    },
    [anim, hideToast]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({ showSaveToast }), [showSaveToast]);

  const variant = toast?.variant ?? "info";
  const accentColor =
    variant === "success"
      ? "#3DDC84"
      : variant === "warning"
      ? "#F2A03D"
      : variant === "error"
      ? "#F87171"
      : "#93C5FD";
  const backgroundColor =
    Platform.OS === "web" ? "rgba(7, 18, 34, 0.86)" : "rgba(7, 18, 34, 0.94)";
  const borderColor =
    variant === "success"
      ? "rgba(61, 220, 132, 0.52)"
      : variant === "warning"
      ? "rgba(242, 160, 61, 0.54)"
      : variant === "error"
      ? "rgba(248, 113, 113, 0.58)"
      : "rgba(147, 197, 253, 0.42)";
  const textColor = "#F8FAFC";
  const mutedTextColor = "rgba(248, 250, 252, 0.72)";
  const iconSymbol =
    variant === "success"
      ? "✓"
      : variant === "warning"
      ? "⚠"
      : variant === "error"
      ? "✕"
      : "i";
  const toastTop = Math.max(16, insets.top + 12);

  const toastContent = toast ? (
    <Animated.View
      pointerEvents="box-none"
      style={{
        ...(Platform.OS === "web"
          ? ({ position: "fixed", top: toastTop, right: 0, left: 0 } as const)
          : ({ position: "absolute", top: toastTop, right: 0, left: 0 } as const)),
        alignItems: "center",
        zIndex: 50000,
        elevation: 50000,
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      } as unknown as ViewStyle}
    >
      <Pressable
        onPress={hideToast}
        style={{
          ...(Platform.OS === "web"
            ? ({
                width: "min(560px, calc(100vw - 32px))",
                backdropFilter: "blur(18px) saturate(155%)",
                WebkitBackdropFilter: "blur(18px) saturate(155%)",
              } as unknown as ViewStyle)
            : ({ width: "92%", maxWidth: 560 } as ViewStyle)),
          overflow: "hidden",
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 18,
          backgroundColor,
          borderWidth: 1,
          borderColor,
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.26)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: accentColor,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.16)",
            }}
          >
            <Text style={{ color: accentColor, fontWeight: "900", fontSize: 13 }}>
              {iconSymbol}
            </Text>
          </View>
          <Text
            style={{
              color: textColor,
              fontWeight: "800",
              flex: 1,
              fontSize: 14,
              lineHeight: 19,
            }}
          >
            {toast.message}
          </Text>
        </View>
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
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
            }}
          >
            <Text style={{ color: mutedTextColor, fontWeight: "800", fontSize: 12 }}>
              {toast.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  ) : null;

  const toastOverlay = toastContent ? (
    <View
      pointerEvents="box-none"
      style={
        Platform.OS === "web"
          ? ({
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 2147483647,
            } as unknown as ViewStyle)
          : {
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 99999,
              elevation: 99999,
            }
      }
    >
      {toastContent}
    </View>
  ) : null;

  return (
    <>
      <SaveToastContext.Provider value={value}>{children}</SaveToastContext.Provider>
      {toastOverlay
        ? Platform.OS === "web" && typeof document !== "undefined"
          ? require("react-dom").createPortal(toastOverlay, document.body)
          : toastOverlay
        : null}
    </>
  );
}

export function useSaveToast() {
  const context = useContext(SaveToastContext);
  if (!context) {
    return { showSaveToast: () => {} };
  }
  return context;
}
