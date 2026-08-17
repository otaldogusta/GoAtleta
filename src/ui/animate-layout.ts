import { LayoutAnimation } from "react-native";

export const animateLayout = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};
