import { createWebPortal } from "./web-portal";
import { NavigationContext } from "expo-router/react-navigation";
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, Modal, Platform, Pressable as RawPressable, StyleSheet, View, useWindowDimensions } from "react-native";
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
  reduceMotion?: boolean;
  onExited?: () => void;
  transition?: "default" | "calendar";
  /** Opt-in semantic dialog and keyboard focus management for migrated sheets. */
  dialogLabel?: string;
};

let activeWebScrollLocks = 0;
let restoreWebScrollLock: (() => void) | null = null;
const activeWebSheets: { id: symbol; zIndex: number }[] = [];
function isTopWebSheet(id: symbol) {
  return activeWebSheets.reduce<(typeof activeWebSheets)[number] | undefined>((top, sheet) =>
    !top || sheet.zIndex >= top.zIndex ? sheet : top, undefined)?.id === id;
}

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
  reduceMotion = false,
  onExited,
  transition = "default",
  dialogLabel,
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
  const calendarTransition = transition === "calendar";
  const exitState = useRef({ effectiveVisible, routeFocused, onExited });
  useLayoutEffect(() => { exitState.current = { effectiveVisible, routeFocused, onExited }; }, [effectiveVisible, routeFocused, onExited]);
  const [anim] = useState(() => new Animated.Value(effectiveVisible && reduceMotion ? 1 : 0));
  const [isMounted, setIsMounted] = useState(effectiveVisible);
  const hasExited = useRef(!effectiveVisible);
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
  const { width: viewportWidth } = useWindowDimensions();
  const flatCardStyle = StyleSheet.flatten(resolvedCardStyle);
  const preferredWidth = typeof flatCardStyle.width === "number" ? flatCardStyle.width : flatCardStyle.maxWidth;
  const sheetWidth = Math.max(0, Math.min(viewportWidth, typeof preferredWidth === "number" && Number.isFinite(preferredWidth) ? preferredWidth : viewportWidth));
  const calendarOffset = isRight ? sheetWidth : (viewportWidth + sheetWidth) / 2;
  const blocking = effectiveVisible || (calendarTransition && routeFocused && isMounted);
  const dialogRef = useRef<View>(null);
  const sheetId = useRef(Symbol("ModalSheet"));

  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !effectiveVisible) return;
    const sheet = { id: sheetId.current, zIndex: overlayZIndex };
    activeWebSheets.push(sheet);
    return () => { activeWebSheets.splice(activeWebSheets.indexOf(sheet), 1); };
  }, [effectiveVisible, overlayZIndex]);

  useLayoutEffect(() => {
    if (!dialogLabel || !effectiveVisible || !isMounted || Platform.OS !== "web" || typeof document === "undefined" || typeof HTMLElement === "undefined") return;
    const dialog = dialogRef.current as unknown as HTMLElement | null;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selector = 'button, input, textarea, select, a[href], [tabindex="0"]';
    const visibleTarget = (node: HTMLElement) => !node.matches(':disabled, [aria-disabled="true"]') && !node.closest('[inert], [aria-hidden="true"]') && node.getClientRects().length > 0;
    let overlay = dialog;
    while (overlay.parentElement && overlay.parentElement !== document.body) overlay = overlay.parentElement;
    const siblings = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== overlay && !node.inert);
    siblings.forEach((node) => { node.inert = true; });
    ([...dialog.querySelectorAll<HTMLElement>(selector)].find(visibleTarget) ?? dialog).focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Tab" || !isTopWebSheet(sheetId.current)) return;
      // A portalled select manages its own arrows and Tab back into this dialog.
      if (document.activeElement?.closest('[role="listbox"]') && !dialog.contains(document.activeElement)) return;
      const targets = [...dialog.querySelectorAll<HTMLElement>(selector)].filter(visibleTarget);
      const index = targets.indexOf(document.activeElement as HTMLElement);
      if (index >= 0 && (event.shiftKey ? index > 0 : index < targets.length - 1)) return;
      event.preventDefault();
      (targets[event.shiftKey ? targets.length - 1 : 0] ?? dialog).focus();
    };
    // RN Web TextInput stops bubbling; capture inside the card also leaves
    // portalled selects free to handle Escape and Tab in their own surface.
    dialog.addEventListener("keydown", trap, true);
    return () => {
      dialog.removeEventListener("keydown", trap, true);
      siblings.forEach((node) => { node.inert = false; });
      if (previous?.isConnected && visibleTarget(previous)) previous.focus({ preventScroll: true });
    };
  }, [dialogLabel, effectiveVisible, isMounted]);

  useLayoutEffect(() => {
    if (!routeFocused) {
      anim.stopAnimation();
      anim.setValue(0);
      hasExited.current = true;
      return;
    }
    if (calendarTransition) {
      anim.stopAnimation();
      if (reduceMotion) anim.setValue(effectiveVisible ? 1 : 0);
      else if (effectiveVisible && hasExited.current) anim.setValue(0);
      if (effectiveVisible) hasExited.current = false;
      return;
    }
    if (!effectiveVisible) {
      if (reduceMotion) { anim.stopAnimation(); anim.setValue(0); }
      return;
    }
    anim.stopAnimation();
    anim.setValue(reduceMotion ? 1 : 0);
  }, [anim, effectiveVisible, routeFocused, reduceMotion, calendarTransition]);

  useEffect(() => {
    if (!effectiveVisible) return undefined;
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: reduceMotion ? 0 : calendarTransition ? 260 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, effectiveVisible, reduceMotion, calendarTransition]);

  useEffect(() => {
    if (!routeFocused || effectiveVisible || !isMounted) return undefined;
    let current = true;
    const animation = Animated.timing(anim, {
      toValue: 0,
      duration: reduceMotion ? 0 : calendarTransition ? 240 : 180,
      easing: calendarTransition ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!current || !finished || exitState.current.effectiveVisible || !exitState.current.routeFocused) return;
      current = false;
      hasExited.current = true;
      setIsMounted(false);
      exitState.current.onExited?.();
    });
    return () => { current = false; animation.stop(); };
  }, [anim, effectiveVisible, isMounted, routeFocused, reduceMotion, calendarTransition]);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || !blocking) return undefined;
    return acquireWebScrollLock();
  }, [blocking]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !effectiveVisible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Escape" || !isTopWebSheet(sheetId.current)) return;
      event.preventDefault();
      onClose();
    };

    const card = dialogRef.current as unknown as HTMLElement | null;
    card?.addEventListener?.("keydown", handleKeyDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      card?.removeEventListener?.("keydown", handleKeyDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
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
      pointerEvents={blocking ? "auto" : "none"}
    >
      <RawPressable
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        onPress={calendarTransition && !effectiveVisible ? undefined : onClose}
        pointerEvents={blocking ? "auto" : "none"}
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
          ref={dialogRef}
          {...(dialogLabel ? { role: "dialog" as const, "aria-modal": true, accessibilityLabel: dialogLabel, tabIndex: -1, "aria-hidden": !effectiveVisible } : {})}
          pointerEvents={calendarTransition && !effectiveVisible ? "none" : "auto"}
          style={[
            resolvedCardStyle,
            {
              opacity: calendarTransition ? 1 : anim,
              transform: calendarTransition ? [{
                translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [calendarOffset, 0] }),
              }] : [
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
      animationType={reduceMotion || calendarTransition ? "none" : "fade"}
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
