import { usePathname } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    Platform,
    type RefObject,
    ScrollView,
    StyleProp,
    View,
    ViewStyle,
} from "react-native";
import { useAppTheme } from "./app-theme";

type Layout = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

type AnchoredDropdownProps = {
  visible: boolean;
  layout: Layout | null;
  container: Point | null;
  animationStyle: StyleProp<ViewStyle>;
  zIndex: number;
  maxHeight: number;
  nestedScrollEnabled: boolean;
  panelStyle?: StyleProp<ViewStyle>;
  scrollContentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  onRequestClose?: () => void;
  showVerticalScrollIndicator?: boolean;
  portalToBodyOnWeb?: boolean;
  interactiveRefs?: Array<RefObject<View | null>>;
};

const DEFAULT_DROPDOWN_MAX_HEIGHT = 126;

export function AnchoredDropdown({
  visible,
  layout,
  container,
  animationStyle,
  zIndex = 300,
  maxHeight = 220,
  nestedScrollEnabled = false,
  panelStyle,
  scrollContentStyle,
  children,
  onRequestClose,
  showVerticalScrollIndicator = true,
  portalToBodyOnWeb = true,
  interactiveRefs,
}: AnchoredDropdownProps) {
  const { colors, mode } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const panelRef = useRef<View | null>(null);
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      previousPathnameRef.current = pathname ?? null;
      return;
    }

    if (
      previousPathnameRef.current &&
      pathname &&
      previousPathnameRef.current !== pathname
    ) {
      onRequestClose?.();
    }

    previousPathnameRef.current = pathname ?? null;
  }, [onRequestClose, pathname, visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible || typeof document === "undefined") return;

    const isEventInsidePanel = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;

      const panelElement = panelRef.current as unknown as HTMLElement | null;
      if (panelElement?.contains(target)) return true;

      return (interactiveRefs ?? []).some((ref) => {
        const element = ref.current as unknown as HTMLElement | null;
        return Boolean(element?.contains(target));
      });
    };

    const handleVisibilityOrBlur = () => {
      onRequestClose?.();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isEventInsidePanel(event.target)) return;
      onRequestClose?.();
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isEventInsidePanel(event.target)) return;
      onRequestClose?.();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onRequestClose?.();
    };

    window.addEventListener("blur", handleVisibilityOrBlur);
    document.addEventListener("visibilitychange", handleVisibilityOrBlur);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("blur", handleVisibilityOrBlur);
      document.removeEventListener("visibilitychange", handleVisibilityOrBlur);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [interactiveRefs, onRequestClose, visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible || !layout) return;

    const element = scrollRef.current as unknown as HTMLElement | null;
    if (!element || typeof element.addEventListener !== "function") return;

    const handleWheel = (event: WheelEvent) => {
      const canScroll = element.scrollHeight > element.clientHeight + 1;
      if (!canScroll) {
        event.preventDefault();
        return;
      }

      const deltaY = event.deltaY;
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
      const scrollingUp = deltaY < 0;
      const scrollingDown = deltaY > 0;

      if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
        event.preventDefault();
      }
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [layout, visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (!visible) return;

    document.body.classList.add("dropdown-scrollbars");
    document.documentElement.classList.add("dropdown-scrollbars");
    return () => {
      document.body.classList.remove("dropdown-scrollbars");
      document.documentElement.classList.remove("dropdown-scrollbars");
    };
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible || !scrollRef.current) return;

    const element = scrollRef.current as unknown as HTMLElement | null;
    if (!element) return;

    const previous = {
      overflowX: element.style.overflowX,
      overflowY: element.style.overflowY,
      scrollbarWidth: element.style.scrollbarWidth,
      scrollbarColor: element.style.scrollbarColor,
      msOverflowStyle:
        (element.style as CSSStyleDeclaration & { msOverflowStyle?: string }).msOverflowStyle ?? "",
    };

    element.style.overflowX = "hidden";
    element.style.overflowY = "scroll";
    element.style.scrollbarWidth = "thin";
    element.style.scrollbarColor = `${colors.border} transparent`;
    (element.style as CSSStyleDeclaration & { msOverflowStyle?: string }).msOverflowStyle = "auto";

    return () => {
      element.style.overflowX = previous.overflowX;
      element.style.overflowY = previous.overflowY;
      element.style.scrollbarWidth = previous.scrollbarWidth;
      element.style.scrollbarColor = previous.scrollbarColor;
      (element.style as CSSStyleDeclaration & { msOverflowStyle?: string }).msOverflowStyle = previous.msOverflowStyle;
    };
  }, [colors.border, visible]);

  if (!visible || !layout) return null;

  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;
  const useViewportCoordinates = Platform.OS === "web" && portalToBodyOnWeb;
  const availableWidth = Math.max(180, windowWidth - 24);
  const measuredWidth = layout.width > 0 ? layout.width : 240;
  const resolvedWidth = Math.min(measuredWidth, availableWidth);
  const resolvedMaxHeight = Math.min(maxHeight, DEFAULT_DROPDOWN_MAX_HEIGHT, Math.floor(windowHeight * 0.23));
  const leftBase = useViewportCoordinates || !container ? layout.x : layout.x - container.x;
  const left = Math.max(16, Math.min(leftBase, windowWidth - 16 - resolvedWidth));
  const defaultTop = useViewportCoordinates || !container
    ? layout.y + layout.height + 8
    : layout.y - container.y + layout.height + 8;
  const availableBottom = windowHeight - 24;
  const top =
    defaultTop + resolvedMaxHeight > availableBottom
      ? Math.max(8, defaultTop - layout.height - resolvedMaxHeight)
      : defaultTop;
  const webGlassPanelStyle =
    Platform.OS === "web"
      ? ({
          backgroundColor:
            mode === "dark"
              ? "rgba(14, 22, 38, 0.84)"
              : "rgba(255, 255, 255, 0.9)",
          backgroundImage:
            mode === "dark"
              ? "linear-gradient(180deg, rgba(24,34,56,0.94) 0%, rgba(13,20,35,0.9) 100%)"
              : "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(245,248,252,0.9) 100%)",
          backdropFilter: "blur(20px) saturate(170%)",
          WebkitBackdropFilter: "blur(20px) saturate(170%)",
          boxShadow:
            mode === "dark"
              ? "0 18px 40px rgba(0, 0, 0, 0.34)"
              : "0 18px 40px rgba(15, 23, 42, 0.16)",
        } as ViewStyle)
      : null;

  const dropdown = (
    <Animated.View
      ref={panelRef}
      style={[
        {
          position: Platform.OS === "web" ? "fixed" : "absolute",
          left,
          top,
          width: resolvedWidth,
          minWidth: resolvedWidth,
          zIndex,
          elevation: zIndex,
        },
        animationStyle,
      ]}
    >
      <View
        style={[
          panelStyle,
          {
            height: resolvedMaxHeight,
            maxHeight: resolvedMaxHeight,
            borderRadius: 18,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            shadowColor: "#000",
            shadowOpacity: 0.16,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 12 },
            elevation: 14,
          },
          webGlassPanelStyle,
        ]}
      >
        <ScrollView
          ref={scrollRef}
          style={[
            { height: resolvedMaxHeight, maxHeight: resolvedMaxHeight },
          ]}
          contentContainerStyle={[{ padding: 8, gap: 6, paddingBottom: 10 }, scrollContentStyle]}
          nestedScrollEnabled={nestedScrollEnabled}
          showsVerticalScrollIndicator={showVerticalScrollIndicator}
          persistentScrollbar={Platform.OS === "android"}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          overScrollMode={Platform.OS === "android" ? "always" : "auto"}
        >
          {children}
        </ScrollView>
      </View>
    </Animated.View>
  );

  if (Platform.OS === "web" && portalToBodyOnWeb && typeof document !== "undefined") {
    const ReactDOM = require("react-dom");
    return ReactDOM.createPortal(dropdown, document.body);
  }

  return dropdown;
}
