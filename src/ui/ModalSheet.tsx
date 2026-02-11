import { useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Modal, Platform, Pressable as RawPressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useModalCardStyle } from "./use-modal-card-style";

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  cardStyle: StyleProp<ViewStyle>;
  backdropOpacity?: number;
  slideOffset?: number;
  position?: "bottom" | "center";
  overlayZIndex?: number;
  bottomOffset?: number;
};

export function ModalSheet({
  visible,
  onClose,
  children,
  cardStyle,
  backdropOpacity = 0.5,
  slideOffset = 24,
  position = "bottom",
  overlayZIndex = 1000,
  bottomOffset,
}: ModalSheetProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const previousOverflow = useRef<string | null>(null);
  const previousHtmlOverflow = useRef<string | null>(null);
  const previousPosition = useRef<string | null>(null);
  const previousTop = useRef<string | null>(null);
  const previousWidth = useRef<string | null>(null);
  const previousOverscroll = useRef<string | null>(null);
  const previousHtmlOverscroll = useRef<string | null>(null);
  const previousRootOverflow = useRef<string | null>(null);
  const previousRootHeight = useRef<string | null>(null);
  const previousRootOverscroll = useRef<string | null>(null);
  const lockedScrollY = useRef(0);
  const isCenter = position === "center";
  const insets = useSafeAreaInsets();
  const resolvedBottomOffset = isCenter
    ? 0
    : Math.max(bottomOffset ?? 0, insets.bottom);
  const baseCardStyle = useModalCardStyle();
  const resolvedCardStyle = [baseCardStyle, cardStyle];

  useEffect(() => {
    if (!visible) {
      anim.setValue(0);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (visible) {
      if (previousOverflow.current === null) {
        previousOverflow.current = document.body.style.overflow;
      }
      if (previousHtmlOverflow.current === null) {
        previousHtmlOverflow.current = document.documentElement.style.overflow;
      }
      if (previousOverscroll.current === null) {
        previousOverscroll.current = document.body.style.overscrollBehavior;
      }
      if (previousHtmlOverscroll.current === null) {
        previousHtmlOverscroll.current = document.documentElement.style.overscrollBehavior;
      }
      if (previousPosition.current === null) {
        previousPosition.current = document.body.style.position;
      }
      if (previousTop.current === null) {
        previousTop.current = document.body.style.top;
      }
      if (previousWidth.current === null) {
        previousWidth.current = document.body.style.width;
      }
      lockedScrollY.current = window.scrollY || 0;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overscrollBehavior = "none";
      document.body.style.position = "fixed";
      document.body.style.top = `-${lockedScrollY.current}px`;
      document.body.style.width = "100%";
      const root = document.getElementById("root") || document.getElementById("app");
      if (root) {
        if (previousRootOverflow.current === null) {
          previousRootOverflow.current = root.style.overflow;
        }
        if (previousRootHeight.current === null) {
          previousRootHeight.current = root.style.height;
        }
        if (previousRootOverscroll.current === null) {
          previousRootOverscroll.current = root.style.overscrollBehavior;
        }
        root.style.overflow = "hidden";
        root.style.height = "100%";
        root.style.overscrollBehavior = "none";
      }
      return;
    }
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
    if (previousHtmlOverflow.current !== null) {
      document.documentElement.style.overflow = previousHtmlOverflow.current;
      previousHtmlOverflow.current = null;
    }
    if (previousOverscroll.current !== null) {
      document.body.style.overscrollBehavior = previousOverscroll.current;
      previousOverscroll.current = null;
    }
    if (previousHtmlOverscroll.current !== null) {
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll.current;
      previousHtmlOverscroll.current = null;
    }
    if (previousPosition.current !== null) {
      document.body.style.position = previousPosition.current;
      previousPosition.current = null;
    }
    if (previousTop.current !== null) {
      document.body.style.top = previousTop.current;
      previousTop.current = null;
    }
    if (previousWidth.current !== null) {
      document.body.style.width = previousWidth.current;
      previousWidth.current = null;
    }
    const root = document.getElementById("root") || document.getElementById("app");
    if (root) {
      if (previousRootOverflow.current !== null) {
        root.style.overflow = previousRootOverflow.current;
        previousRootOverflow.current = null;
      }
      if (previousRootHeight.current !== null) {
        root.style.height = previousRootHeight.current;
        previousRootHeight.current = null;
      }
      if (previousRootOverscroll.current !== null) {
        root.style.overscrollBehavior = previousRootOverscroll.current;
        previousRootOverscroll.current = null;
      }
    }
    if (lockedScrollY.current) {
      window.scrollTo(0, lockedScrollY.current);
      lockedScrollY.current = 0;
    }
  }, [visible]);

  if (Platform.OS === "web" && !visible) {
    return null;
  }

  const content = (
    <View
      style={{
        flex: 1,
        zIndex: overlayZIndex,
        elevation: overlayZIndex,
        ...(Platform.OS === "web"
          ? { position: "fixed", top: 0, right: 0, bottom: 0, left: 0 }
          : null),
      }}
      pointerEvents={visible ? "auto" : "none"}
    >
      <RawPressable
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        onPress={onClose}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
            opacity: anim,
          }}
        />
      </RawPressable>
      <View
        style={
          isCenter
            ? { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }
            : { position: "absolute", left: 0, right: 0, bottom: resolvedBottomOffset }
        }
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            resolvedCardStyle,
            {
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [slideOffset, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    const ReactDOM = require("react-dom");
    return ReactDOM.createPortal(content, document.body);
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
      hardwareAccelerated={Platform.OS === "android"}
    >
      {content}
    </Modal>
  );
}
