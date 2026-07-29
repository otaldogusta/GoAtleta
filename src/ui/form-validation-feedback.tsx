import {
  AccessibilityInfo,
  Animated,
  Platform,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { radius } from "../theme/tokens";
import { useAppTheme } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";

export type FormValidationIssue<Field extends string> = {
  field: Field;
  message: string;
  attempt: number;
};

export const nextFormValidationIssue = <Field extends string>(
  current: FormValidationIssue<Field> | null,
  field: Field,
  message: string
): FormValidationIssue<Field> => ({
  field,
  message,
  attempt: (current?.attempt ?? 0) + 1,
});

export function useFormValidationFeedback<Field extends string>() {
  const [issue, setIssue] = useState<FormValidationIssue<Field> | null>(null);

  const showValidationError = useCallback((field: Field, message: string) => {
    setIssue((current) => nextFormValidationIssue(current, field, message));
  }, []);

  const clearValidationError = useCallback((field?: Field) => {
    setIssue((current) => {
      if (!current || (field && current.field !== field)) return current;
      return null;
    });
  }, []);

  return {
    issue,
    showValidationError,
    clearValidationError,
    messageFor: (field: Field) => (issue?.field === field ? issue.message : ""),
    attemptFor: (field: Field) => (issue?.field === field ? issue.attempt : 0),
    isInvalid: (field: Field) => issue?.field === field,
  };
}

export function FormFieldValidationFeedback({
  message,
  attempt = 0,
  children,
  style,
  presentation = "inline",
}: {
  message?: string | null;
  attempt?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  presentation?: "inline" | "floating";
}) {
  const { colors } = useAppTheme();
  const [translateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message || attempt <= 0) {
      translateX.setValue(0);
      return undefined;
    }

    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) return;
      const useNativeDriver = Platform.OS !== "web";
      translateX.setValue(0);
      animation = Animated.sequence([
        Animated.timing(translateX, { toValue: 7, duration: 45, useNativeDriver }),
        Animated.timing(translateX, { toValue: -7, duration: 55, useNativeDriver }),
        Animated.timing(translateX, { toValue: 5, duration: 55, useNativeDriver }),
        Animated.timing(translateX, { toValue: -4, duration: 55, useNativeDriver }),
        Animated.timing(translateX, { toValue: 0, duration: 65, useNativeDriver }),
      ]);
      animation.start();
    });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [attempt, message, translateX]);

  const feedback = message ? (
    <View
      pointerEvents="none"
      style={
        presentation === "floating"
          ? {
              position: "absolute",
              left: 8,
              bottom: "100%",
              marginBottom: 8,
              zIndex: 20,
            }
          : undefined
      }
    >
      <View
        accessibilityRole="alert"
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: presentation === "inline" ? 6 : 0,
          borderRadius: radius.internal,
          backgroundColor: colors.dangerSolidBg,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
      >
        <GoAtletaIcon name="warningCircle" size={14} color={colors.dangerSolidText} />
        <Text
          style={{
            color: colors.dangerSolidText,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {message}
        </Text>
      </View>
      {presentation === "floating" ? (
        <View
          style={{
            position: "absolute",
            left: 18,
            bottom: -4,
            width: 8,
            height: 8,
            backgroundColor: colors.dangerSolidBg,
            transform: [{ rotate: "45deg" }],
          }}
        />
      ) : null}
    </View>
  ) : null;

  return (
    <Animated.View
      style={[
        style,
        presentation === "floating"
          ? { position: "relative", zIndex: message ? 20 : 0 }
          : null,
        { transform: [{ translateX }] },
      ]}
    >
      {presentation === "inline" ? feedback : null}
      {children}
      {presentation === "floating" ? feedback : null}
    </Animated.View>
  );
}

export const getValidationFieldStyle = (
  invalid: boolean,
  dangerBorder: string
): { borderColor: string; borderWidth: number } | null =>
  invalid
    ? {
        borderColor: dangerBorder,
        borderWidth: 2,
      }
    : null;
