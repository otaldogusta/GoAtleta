import { createWebPortal } from "./web-portal";
import { NavigationContext } from "expo-router/react-navigation";
import { useCallback, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
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
  respectBottomInset?: boolean;
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
  respectBottomInset = true,
}: ModalSheetProps) {
  // Providers outside a route (for example global confirmations) have no screen
  // navigation context and remain visible. Native presentation is unchanged.
  const navigation = useContext(NavigationContext);
  const observeFocus = Platform.OS === "web" && visible;
  const subscribeFocus = useCallback((notify: () => void) => {
    if (!observeFocus || !navigation) return () => {};
    const unsubscribeFocus = navigation.addListener("focus", notify);
    const unsubscribeBlur = navigation.addListener("blur", notify);
    return () => { unsubscribeFocus(); unsubscribeBlur(); };
  }, [navigation, observeFocus]);
  const getFocus = useCallback(() => observeFocus ? navigation?.isFocused() ?? true : true, [navigation, observeFocus]);
  const routeFocused = useSyncExternalStore(subscribeFocus, getFocus, () => true);
  const effectiveVisible = visible && routeFocused;
  const [anim] = useState(() => new Animated.Value(0));
  const [isMounted, setIsMounted] = useState(effectiveVisible);
  if (effectiveVisible && !isMounted) setIsMounted(true);
  else if (!routeFocused && isMounted) setIsMounted(false);
  const isCenter = position === "center";
  const isRight = position === "right";
  const insets = useSafeAreaInsets();
  const resolvedBottomOffset = isCenter
    ? 0
    : Math.max(bottomOffset ?? 0, respectBottomInset ? insets.bottom : 0);
  const baseCardStyle = useModalCardStyle();
  const resolvedCardStyle = [baseCardStyle, cardStyle];

  useLayoutEffect(() => {
    if (!routeFocused) {
      anim.stopAnimation();
      anim.setValue(0);
      return;
    }
    if (!effectiveVisible) return;
    anim.stopAnimation();
    anim.setValue(0);
  }, [anim, effectiveVisible, routeFocused]);

  useEffect(() => {
    if (!effectiveVisible) return undefined;
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, effectiveVisible]);

  useEffect(() => {
    if (!routeFocused || effectiveVisible || !isMounted) return undefined;
    const animation = Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setIsMounted(false);
    });
    return () => animation.stop();
  }, [anim, effectiveVisible, isMounted, routeFocused]);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || !effectiveVisible) return undefined;
    return acquireWebScrollLock();
  }, [effectiveVisible]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !effectiveVisible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, effectiveVisible]);

  if (!routeFocused || (!isMounted && !effectiveVisible)) {
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
      pointerEvents={effectiveVisible ? "auto" : "none"}
    >
      <RawPressable
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        onPress={onClose}
        pointerEvents={effectiveVisible ? "auto" : "none"}
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
            ? {
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: containerPadding + insets.top,
                paddingRight: containerPadding + insets.right,
                paddingBottom: containerPadding + insets.bottom,
                paddingLeft: containerPadding + insets.left,
              }
            : isRight
              ? {
                  flex: 1,
                  width: "100%",
                  alignItems: "flex-end",
                  justifyContent: "flex-start",
                  paddingTop: containerPadding + insets.top,
                  paddingRight: containerPadding + insets.right,
                  paddingBottom: containerPadding + insets.bottom,
                  paddingLeft: containerPadding + insets.left,
                }
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
    return createWebPortal(content, document.body);
  }

  return (
    <Modal
      visible={effectiveVisible || isMounted}
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
