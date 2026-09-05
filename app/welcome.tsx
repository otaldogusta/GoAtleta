import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,

  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  ScrollView,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { markRender } from "../src/observability/perf";
import { useAppTheme } from "../src/ui/app-theme";
import { GoAtletaBrandLockup } from "../src/ui/GoAtletaBrand";
import { Pressable } from "../src/ui/Pressable";

const CAROUSEL_SLIDES = [
  {
    id: "volei-quadra",
    tagline1: "Junte sua equipe.",
    tagline2: "Evolua mais atletas.",
    sportLabel: "Vôlei de Quadra",
    image: require("../assets/images/welcome_carousel_volei_quadra.jpg"),
  },
  {
    id: "volei-praia",
    tagline1: "Domine a areia.",
    tagline2: "Treinos ao ar livre.",
    sportLabel: "Vôlei de Praia",
    image: require("../assets/images/welcome_carousel_volei_praia.jpg"),
  },
  {
    id: "futebol",
    tagline1: "Entre em campo.",
    tagline2: "Gestão do futebol.",
    sportLabel: "Futebol & Society",
    image: require("../assets/images/welcome_carousel_futebol.jpg"),
  },
  {
    id: "academia",
    tagline1: "Supere seus limites.",
    tagline2: "Alta performance.",
    sportLabel: "Academia & Fit",
    image: require("../assets/images/welcome_carousel_academia.jpg"),
  },
];

// perf-check: ignore-measure - rota estática sem carregamento assíncrono.
export default function WelcomeScreen() {
  markRender("screen.welcome.render.root");
  const { colors, mode } = useAppTheme();
  const router = useRouter();
  const [enterAnim] = useState(() => new Animated.Value(0));
  const [fadeTextAnim] = useState(() => new Animated.Value(1));
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(392);
  const isProgrammaticScroll = useRef(false);
  const scrollTimeout = useRef<any>(null);

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  const updateActiveIndexSmoothly = useCallback((newIndex: number) => {
    setActiveIndex((prevIndex) => {
      if (prevIndex === newIndex) return prevIndex;
      // Transição suave de texto sem flicker
      Animated.sequence([
        Animated.timing(fadeTextAnim, {
          toValue: 0.15,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(fadeTextAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
      return newIndex;
    });
  }, [fadeTextAnim]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isProgrammaticScroll.current) return;
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const width = event.nativeEvent.layoutMeasurement.width || containerWidth;
    if (width > 0) {
      const index = Math.round(scrollOffset / width);
      const clamped = Math.max(0, Math.min(CAROUSEL_SLIDES.length - 1, index));
      updateActiveIndexSmoothly(clamped);
    }
  }, [containerWidth, updateActiveIndexSmoothly]);

  const scrollToSlide = (index: number) => {
    if (index === activeIndex) return;
    isProgrammaticScroll.current = true;
    updateActiveIndexSmoothly(index);

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * containerWidth,
        animated: true,
      });
    }

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 350);
  };

  const primaryBtnBg = mode === "dark" ? "#3DDC84" : "#27B86A";
  const primaryBtnText = "#FFFFFF";
  const secondaryBtnBg = mode === "dark" ? "#121c30" : colors.secondaryBg;
  const currentSlide = CAROUSEL_SLIDES[activeIndex] || CAROUSEL_SLIDES[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Animated.View
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width - 48;
            if (w > 0) setContainerWidth(w);
          }}
          style={{
            flex: 1,
            justifyContent: "space-between",
            maxWidth: 440,
            width: "100%",
            alignSelf: "center",
            paddingHorizontal: 24,
            paddingVertical: 20,
            opacity: enterAnim,
            transform: [
              {
                translateY: enterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          }}
        >
          {/* Header Brand & Dynamic Tagline Section */}
          <View style={{ gap: 14, marginTop: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <GoAtletaBrandLockup
                height={38}
                tone={mode === "dark" ? "light" : "navy"}
                gap={9}
              />

              {/* Modality Badge Tag */}
              <Animated.View
                style={{
                  opacity: fadeTextAnim,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(14, 23, 41, 0.06)",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: mode === "dark" ? "#3DDC84" : "#27B86A" }}>
                  {currentSlide.sportLabel}
                </Text>
              </Animated.View>
            </View>

            <Animated.View style={{ gap: 4, opacity: fadeTextAnim }}>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: "700",
                  color: colors.text,
                  letterSpacing: -0.4,
                  lineHeight: 32,
                }}
              >
                {currentSlide.tagline1}
              </Text>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: "800",
                  color: mode === "dark" ? "#3DDC84" : "#27B86A",
                  letterSpacing: -0.4,
                  lineHeight: 32,
                }}
              >
                {currentSlide.tagline2}
              </Text>
            </Animated.View>
          </View>

          {/* Swipable Carousel Hero Container */}
          <View
            style={{
              width: "100%",
              height: 230,
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: mode === "dark" ? "rgba(255, 255, 255, 0.1)" : colors.border,
              backgroundColor: colors.card,
              marginVertical: 12,
              ...(Platform.OS === "web"
                ? ({ boxShadow: "0px 10px 28px rgba(0, 0, 0, 0.2)" } as any)
                : {
                    shadowColor: "#000",
                    shadowOpacity: 0.2,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 6,
                  }),
            }}
          >
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              snapToInterval={containerWidth}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              nestedScrollEnabled
              style={{ width: "100%", height: "100%" }}
            >
              {CAROUSEL_SLIDES.map((slide) => (
                <View
                  key={slide.id}
                  style={{
                    width: containerWidth,
                    height: 230,
                    overflow: "hidden",
                  }}
                >
                  <Image
                    source={slide.image}
                    style={{ width: "100%", height: "100%", resizeMode: "cover" }}
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Action Buttons & 4 Interactive Indicator Dots */}
          <View style={{ gap: 14, marginBottom: 6 }}>
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => router.push("/signup")}
                suppressWebHoverFeedback
                style={({ pressed, hovered }: any) => ({
                  height: 50,
                  borderRadius: 14,
                  backgroundColor: hovered && mode === "dark" ? "#27B86A" : primaryBtnBg,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <Text
                  style={{
                    color: primaryBtnText,
                    fontWeight: "800",
                    fontSize: 16,
                    letterSpacing: -0.2,
                  }}
                >
                  Criar conta
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/login")}
                suppressWebHoverFeedback
                style={({ pressed, hovered }: any) => ({
                  height: 50,
                  borderRadius: 14,
                  backgroundColor: secondaryBtnBg,
                  borderWidth: 1,
                  borderColor: hovered ? colors.primaryBg : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                {({ hovered }: any) => (
                  <Text
                    style={{
                      color: hovered ? colors.primaryBg : colors.text,
                      fontWeight: "700",
                      fontSize: 16,
                      letterSpacing: -0.2,
                    }}
                  >
                    Entrar
                  </Text>
                )}
              </Pressable>
            </View>

            {/* 4 Interactive Indicator Dots */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              {CAROUSEL_SLIDES.map((_, idx) => {
                const isActive = activeIndex === idx;
                return (
                  <Pressable
                    key={String(idx)}
                    onPress={() => scrollToSlide(idx)}
                    suppressWebHoverFeedback
                    style={{ padding: 4 }}
                  >
                    <View
                      style={{
                        width: isActive ? 20 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: isActive
                          ? mode === "dark"
                            ? "#3DDC84"
                            : "#27B86A"
                          : mode === "dark"
                          ? "rgba(255, 255, 255, 0.22)"
                          : "rgba(14, 23, 41, 0.18)",
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
