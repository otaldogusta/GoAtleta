import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";

type BirthdayAvatarProps = {
  colors: ThemeColors;
  photoUrl?: string;
  isBirthdayToday?: boolean;
  size?: number;
};

export function BirthdayAvatar(props: BirthdayAvatarProps) {
  return <BirthdayAvatarContent key={props.photoUrl ?? ""} {...props} />;
}

function BirthdayAvatarContent({
  colors,
  photoUrl,
  isBirthdayToday = false,
  size = 34,
}: BirthdayAvatarProps) {
  const radius = size / 2;
  const hatSize = Math.round(size * 0.72);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !photoFailed;

return (
    <View
      accessible={isBirthdayToday}
      accessibilityLabel={
        isBirthdayToday ? "Aniversariante de hoje" : undefined
      }
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        position: "relative",
        overflow: "visible",
      }}
    >
      {isBirthdayToday ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            bottom: -3,
            left: -3,
            borderRadius: radius + 3,
            borderWidth: 2,
            borderColor: colors.warningText,
            backgroundColor: colors.warningBg,
            zIndex: 0,
          }}
        />
      ) : null}

      {showPhoto ? (
        <Image
          source={{ uri: photoUrl }}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            zIndex: 1,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setPhotoFailed(true)}
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
            zIndex: 1,
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
            zIndex: 3,
            transform: [{ rotate: "12deg" }],
          }}
        />
      ) : null}
    </View>
  );
}
