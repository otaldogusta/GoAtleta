import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { navigateToDetailRoute, navigateToPrimaryRoute } from "../../../navigation/primary-route-navigation";
import { compactUiMetrics as metrics, radius } from "../../../theme/tokens";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { HomeSearchModal, type HomeSearchEntry } from "./HomeSearchModal";

export type HomeSearchShortcut = HomeSearchEntry & { href: Href };

export function HomeShortcutSearch({ triggerId, entries }: {
  triggerId: string;
  entries: readonly HomeSearchShortcut[];
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useFocusEffect(useCallback(() => () => setOpen(false), []));

  const close = useCallback(() => {
    setOpen(false);
    if (Platform.OS === "web") {
      requestAnimationFrame(() => document.getElementById(triggerId)?.focus());
    }
  }, [triggerId]);

  const select = (entry: HomeSearchEntry) => {
    const shortcut = entries.find(candidate => candidate === entry);
    if (!shortcut) return;
    setOpen(false);
    if (typeof shortcut.href === "string") navigateToPrimaryRoute({ router, href: shortcut.href });
    else navigateToDetailRoute({ router, href: shortcut.href });
  };

  return (
    <>
      <Pressable
        nativeID={triggerId}
        accessibilityRole="button"
        accessibilityLabel="Pesquisar no app"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={{
          width: metrics.touchTarget,
          height: metrics.touchTarget,
          borderRadius: radius.internal,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name="search" size={metrics.iconSize} color={colors.text} />
      </Pressable>
      {open ? (
        <HomeSearchModal visible entries={entries} colors={colors} onClose={close} onSelect={select} />
      ) : null}
    </>
  );
}
