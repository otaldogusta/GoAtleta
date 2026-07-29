import { Image } from "expo-image";
import { View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";

type BirthdayAvatarProps = {
  colors: ThemeColors;
  photoUrl?: string;
  isBirthdayToday?: boolean;
  size?: number;
};

export function BirthdayAvatar({
  colors,
  photoUrl,
  isBirthdayToday = false,
  size = 34,
}: BirthdayAvatarProps) {
  const radius = size / 2;
  const hatSize = Math.round(size * 0.72);

  return (
    <View
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        position: "relative",
        overflow: "visible",
      }}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon
            name="personSolid"
            size={Math.round(size * 0.47)}
            color={colors.muted}
          />
        </View>
      )}

      {isBirthdayToday ? (
        <Image
          source={require("../../../../assets/images/birthday-party-hat.png")}
          contentFit="contain"
          style={{
            position: "absolute",
            top: -Math.round(hatSize * 0.7),
            left: Math.round(size * 0.42),
            width: hatSize,
            height: hatSize,
            zIndex: 2,
            transform: [{ rotate: "12deg" }],
          }}
        />
      ) : null}
    </View>
  );
}
