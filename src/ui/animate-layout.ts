import { LayoutAnimation, Platform, UIManager } from "react-native";

let layoutAnimationEnabled = false;

const ensureLayoutAnimation = () => {
  if (layoutAnimationEnabled) return;
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  layoutAnimationEnabled = true;
};

export const animateLayout = () => {
  ensureLayoutAnimation();
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};
