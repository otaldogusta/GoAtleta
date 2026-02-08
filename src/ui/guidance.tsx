import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "./app-theme";

type GuidanceContent = {
  title: string;
  items: string[];
  tone: "neutral" | "warning";
  details: Record<string, string>;
};

type GuidanceContextValue = {
  setGuidance: (content: GuidanceContent | null) => void;
};

const GuidanceContext = createContext<GuidanceContextValue | null>(null);
const EMPTY_GUIDANCE: GuidanceContent = {
  title: "",
  items: [],
  tone: "neutral",
  details: {},
};

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const [guidance, setGuidance] = useState<GuidanceContent | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const scale = useState(() => new Animated.Value(0))[0];
  const pulse = useState(() => new Animated.Value(0))[0];
  const currentGuidance = useMemo<GuidanceContent>(() => {
    if (!guidance) return EMPTY_GUIDANCE;
    return {
      title: typeof guidance.title === "string" ? guidance.title : "",
      items: Array.isArray(guidance.items) ? guidance.items : [],
      tone: guidance.tone === "warning" ? "warning" : "neutral",
      details:
        guidance.details && typeof guidance.details === "object"
          ? guidance.details
          : {},
    };
  }, [guidance]);
  const guidanceKey = useMemo(
    () =>
      currentGuidance.items.length
        ? `${currentGuidance.title}|${currentGuidance.items.join("|")}`
        : "",
    [currentGuidance.items, currentGuidance.title]
  );

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      Animated.timing(scale, {
        toValue: next ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      return next;
    });
  }, [scale]);

  const close = useCallback(() => {
    setOpen(false);
    setExpandedItem(null);
    Animated.timing(scale, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  useEffect(() => {
    if (!guidanceKey) return;
    setExpandedItem(null);
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [guidanceKey, pulse]);

  useEffect(() => {
    if (guidance !== null) return;
    setOpen(false);
    setExpandedItem(null);
  }, [guidance]);

  const value = useMemo(() => ({ setGuidance }), [setGuidance]);
  const hasGuidance = currentGuidance.items.length > 0;

  return (
    <GuidanceContext.Provider value={value}>
      {children}
      {hasGuidance ? (
        <>
          {open ? (
            <Pressable
              onPress={close}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
          ) : null}
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              right: 12,
              bottom: 72,
              alignItems: "flex-end",
              zIndex: 20,
            }}
          >
            {open ? (
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: scale.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    },
                  ],
                  opacity: scale,
                }}
              >
                <View
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor:
                      currentGuidance.tone === "warning" ? colors.warningBg : colors.card,
                    borderWidth: 1,
                    borderColor:
                      currentGuidance.tone === "warning"
                        ? colors.warningText
                        : colors.border,
                    width: 260,
                    gap: 6,
                    alignSelf: "flex-end",
                  }}
                >
                  <Text
                    style={{
                      color:
                        currentGuidance.tone === "warning"
                          ? colors.warningText
                          : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    {currentGuidance.title || "Diretrizes"}
                  </Text>
                  {currentGuidance.items.map((item) => {
                    const detail = currentGuidance.details?.[item];
                    return (
                      <View key={item} style={{ gap: 4 }}>
                        {detail ? (
                          <Pressable
                            onPress={() =>
                              setExpandedItem((prev) => (prev === item ? null : item))
                            }
                          >
                            <Text
                              style={{
                                color:
                                  currentGuidance.tone === "warning"
                                    ? colors.warningText
                                    : colors.muted,
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              {"- " + item}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text
                            style={{
                              color:
                                currentGuidance.tone === "warning"
                                  ? colors.warningText
                                  : colors.muted,
                              fontSize: 12,
                            }}
                          >
                            {"- " + item}
                          </Text>
                        )}
                        {detail && expandedItem === item ? (
                          <Text
                            style={{
                              color:
                                currentGuidance.tone === "warning"
                                  ? colors.warningText
                                  : colors.text,
                              fontSize: 11,
                            }}
                          >
                            {detail}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            ) : null}
            <Pressable
              onPress={toggle}
              style={{
                marginTop: open ? 8 : 0,
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.primaryBg,
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.18],
                  }),
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.25],
                      }),
                    },
                  ],
                }}
              />
              <Ionicons name="information" size={18} color={colors.primaryText} />
            </Pressable>
          </View>
        </>
      ) : null}
    </GuidanceContext.Provider>
  );
}

export function useGuidance() {
  const context = useContext(GuidanceContext);
  return context ?? { setGuidance: () => {} };
}
