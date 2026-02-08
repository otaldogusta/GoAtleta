import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable as RawPressable, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useModalCardStyle } from "./use-modal-card-style";

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  cardStyle: StyleProp<ViewStyle>;
  backdropOpacity: number;
  slideOffset: number;
  position: "bottom" | "center";
  overlayZIndex: number;
  bottomOffset: number;
};

export function ModalSheet({
  visible,
  onClose,
  children,
  cardStyle,
  backdropOpacity = 0.5,
  slideOffset = 24,
  position = "bottom",
  overlayZIndex,
  bottomOffset,
}: ModalSheetProps) {
  const anim = useRef(new Animated.Value(0)).current;
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

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, zIndex: overlayZIndex, elevation: overlayZIndex }}>
        <RawPressable
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          onPress={onClose}
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
    </Modal>
  );
}
