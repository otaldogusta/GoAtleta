import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { useCollapsibleAnimation } from "../../../ui/use-collapsible";

type TriggerLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type StudentsExportSyncMenuProps = {
  colors: ThemeColors;
  compact?: boolean;
  disabled?: boolean;
  exportBusy?: boolean;
  onSyncFormsPress: () => void;
  onImportPress: () => void;
  onExportPress: () => void;
};

type MenuRowProps = {
  colors: ThemeColors;
  icon: GoAtletaIconName;
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

function MenuRow({
  colors,
  icon,
  label,
  disabled = false,
  onPress,
}: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(state) => ({
        minHeight: 42,
        paddingHorizontal: 10,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        backgroundColor: state.hovered
          ? (colors.backgroundSubtle ?? colors.secondaryBg)
          : "transparent",
        opacity: disabled ? 0.55 : 1,
      })}
    >
      <GoAtletaIcon
        name={icon}
        size={16}
        color={colors.textMuted ?? colors.muted}
      />
      <Text
        style={{
          color: colors.textPrimary ?? colors.text,
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function StudentsExportSyncMenu({
  colors,
  compact = false,
  disabled = false,
  exportBusy = false,
  onSyncFormsPress,
  onImportPress,
  onExportPress,
}: StudentsExportSyncMenuProps) {
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<TriggerLayout | null>(
    null,
  );
  const { animatedStyle, isVisible } = useCollapsibleAnimation(open, {
    durationIn: 170,
    durationOut: 130,
    translateY: -6,
  });
  const isDisabled = disabled || exportBusy;

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback(() => {
    if (isDisabled) return;
    if (open) {
      close();
      return;
    }

    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const menuWidth = compact ? Math.min(286, Math.max(240, width)) : 296;
      setTriggerLayout({
        x: Math.max(12, x + width - menuWidth),
        y,
        width: menuWidth,
        height,
      });
      setOpen(true);
    });
  }, [close, compact, isDisabled, open]);

  const runAndClose = useCallback(
    (action: () => void) => {
      close();
      action();
    },
    [close],
  );

  const iconColor = colors.textMuted ?? colors.muted;
  const textColor = colors.textPrimary ?? colors.text;

  return (
    <>
      <View ref={triggerRef}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exportar e sincronizar"
          accessibilityState={{ expanded: open, disabled: isDisabled }}
          disabled={isDisabled}
          onPress={toggle}
          style={(state) => ({
            height: 40,
            minWidth: compact ? 42 : 204,
            paddingHorizontal: compact ? 11 : 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: open
              ? (colors.borderStrong ?? colors.border)
              : (colors.borderSubtle ?? colors.border),
            backgroundColor: state.hovered
              ? (colors.backgroundSubtle ?? colors.secondaryBg)
              : "transparent",
            opacity: isDisabled ? 0.55 : 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          })}
        >
          {compact ? (
            <GoAtletaIcon name="download" size={17} color={textColor} />
          ) : (
            <Text style={{ color: textColor, fontSize: 12, fontWeight: "800" }}>
              Exportar e sincronizar
            </Text>
          )}
          <GoAtletaIcon
            name="chevronDown"
            size={15}
            color={iconColor}
            style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
          />
        </Pressable>
      </View>

      <AnchoredDropdown
        visible={isVisible}
        layout={triggerLayout}
        container={null}
        animationStyle={animatedStyle}
        zIndex={1300}
        maxHeight={184}
        nestedScrollEnabled
        density="menu"
        interactiveRefs={[triggerRef]}
        onRequestClose={close}
        showVerticalScrollIndicator={false}
        panelStyle={{ backgroundColor: colors.surfaceElevated ?? colors.card }}
        scrollContentStyle={{ padding: 8, gap: 2 }}
      >
        <MenuRow
          colors={colors}
          icon="download"
          label={exportBusy ? "Exportando..." : "Exportar lista (.xlsx)"}
          disabled={exportBusy}
          onPress={() => runAndClose(onExportPress)}
        />
        <MenuRow
          colors={colors}
          icon="upload"
          label="Importar alunos"
          onPress={() => runAndClose(onImportPress)}
        />
        <MenuRow
          colors={colors}
          icon="sync"
          label="Sincronizar Forms"
          onPress={() => runAndClose(onSyncFormsPress)}
        />
      </AnchoredDropdown>
    </>
  );
}
