import { useRef, useState } from "react";
import { View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";

export function CalendarExportMenu({ disabled, onExport }: { disabled: boolean; onExport: () => void }) {
  const { colors } = useAppTheme();
  const trigger = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  return <>
    <View ref={trigger} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Opções da agenda" accessibilityState={{ expanded: open }} onPress={() => {
        if (open) { setOpen(false); return; }
        trigger.current?.measureInWindow((x, y, width, height) => { setLayout({ x, y, width, height }); setOpen(true); });
      }} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}>
        <GoAtletaIcon name="ellipsisVertical" size={20} color={colors.text} />
      </Pressable>
    </View>
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={4200} maxHeight={100} density="menu" nestedScrollEnabled fitContent preferredWidth={270} align="end" interactiveRefs={[trigger]} onRequestClose={() => setOpen(false)}>
      <AnchoredDropdownOption active={false} disabled={disabled} accessibilityLabel="Exportar Google Calendar (.ics)" onPress={() => { setOpen(false); onExport(); }}>
        <Text style={{ color: colors.text, fontSize: 13 }}>Exportar Google Calendar (.ics)</Text>
      </AnchoredDropdownOption>
    </AnchoredDropdown>
  </>;
}
