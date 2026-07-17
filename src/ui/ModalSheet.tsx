import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, Modal, Platform, Pressable as RawPressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useModalCardStyle } from "./use-modal-card-style";

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  cardStyle: StyleProp<ViewStyle>;
  backdropOpacity?: number;
  slideOffset?: number;
  position?: "bottom" | "center" | "right";
  overlayZIndex?: number;
  bottomOffset?: number;
  containerPadding?: number;
};

let activeWebScrollLocks = 0;
let restoreWebScrollLock: (() => void) | null = null;

function acquireWebScrollLock() {
  if (typeof document === "undefined") return () => undefined;

  activeWebScrollLocks += 1;

  if (activeWebScrollLocks === 1) {
    const body = document.body;
    const html = document.documentElement;
    const root = document.getElementById("root") || document.getElementById("app");
    const scrollY = window.scrollY || 0;
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    const computedPaddingRight = Number.parseFloat(
      window.getComputedStyle(body).paddingRight
    ) || 0;
    const previous = {
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyBoxSizing: body.style.boxSizing,
      bodyScrollbarGutter: body.style.scrollbarGutter,
      bodyPaddingRight: body.style.paddingRight,
      rootOverflow: root?.style.overflow ?? "",
      rootHeight: root?.style.height ?? "",
      rootOverscroll: root?.style.overscrollBehavior ?? "",
    };

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.boxSizing = "border-box";
    body.style.scrollbarGutter = "auto";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
    }
    if (root) {
      root.style.overflow = "hidden";
      root.style.height = "100%";
      root.style.overscrollBehavior = "none";
    }

    restoreWebScrollLock = () => {
      body.style.overflow = previous.bodyOverflow;
      html.style.overflow = previous.htmlOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.boxSizing = previous.bodyBoxSizing;
      body.style.scrollbarGutter = previous.bodyScrollbarGutter;
      body.style.paddingRight = previous.bodyPaddingRight;
      if (root) {
        root.style.overflow = previous.rootOverflow;
        root.style.height = previous.rootHeight;
        root.style.overscrollBehavior = previous.rootOverscroll;
      }
      window.scrollTo(0, scrollY);
    };
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeWebScrollLocks = Math.max(0, activeWebScrollLocks - 1);
    if (activeWebScrollLocks === 0) {
      restoreWebScrollLock?.();
      restoreWebScrollLock = null;
    }
  };
}

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
  containerPadding = 16,
}: ModalSheetProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(visible);
  const isCenter = position === "center";
  const isRight = position === "right";
  const insets = useSafeAreaInsets();
  const resolvedBottomOffset = isCenter
    ? 0
    : Math.max(bottomOffset ?? 0, insets.bottom);
  const baseCardStyle = useModalCardStyle();
  const resolvedCardStyle = [baseCardStyle, cardStyle];

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (!isMounted) return;
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsMounted(false);
    });
  }, [anim, isMounted, visible]);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || !visible) return undefined;
    return acquireWebScrollLock();
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !visible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, visible]);

  if (!isMounted) {
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
      } as unknown as ViewStyle}
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
            ? { flex: 1, alignItems: "center", justifyContent: "center", padding: containerPadding }
            : isRight
              ? { flex: 1, alignItems: "flex-end", justifyContent: "flex-start", padding: containerPadding }
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
                    outputRange: isRight ? [0, 0] : [slideOffset, 0],
                  }),
                },
                ...(isRight
                  ? [
                      {
                        translateX: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [slideOffset, 0],
                        }),
                      },
                    ]
                  : []),
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
      visible={isMounted}
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
