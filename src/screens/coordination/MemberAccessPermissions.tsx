import { View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { MEMBER_PERMISSION_OPTIONS, type MemberPermissionKey } from "../../api/members";
import { radius } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";

export const MEMBER_PERMISSION_GROUPS: { title: string; keys: MemberPermissionKey[] }[] = [
  { title: "Ensino", keys: ["classes", "classes_create", "students", "training", "periodization", "reports", "assistant"] },
  { title: "Comunicação", keys: ["calendar", "events", "absence_notices", "whatsapp_settings"] },
  { title: "Administração", keys: ["financial", "org_members"] },
];

export function MemberAccessPermissions({ selected, roleLevel, disabled, protectOwnManagement, onChange }: {
  selected: MemberPermissionKey[];
  roleLevel: number;
  disabled: boolean;
  protectOwnManagement: boolean;
  onChange: (keys: MemberPermissionKey[]) => void;
}) {
  const { colors } = useAppTheme();
  const admin = roleLevel >= 50;
  return <View style={{ gap: 20 }}>
    {MEMBER_PERMISSION_GROUPS.map(group => <View key={group.title} style={{ padding: 18, gap: 12, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{group.title}</Text>
      {group.keys.map(key => {
        const option = MEMBER_PERMISSION_OPTIONS.find(item => item.key === key)!;
        const protectedPermission = key === "org_members" && protectOwnManagement;
        const checked = admin || protectedPermission || selected.includes(key);
        const locked = disabled || admin || protectedPermission;
        const needsClasses = key === "classes_create" && !admin && !selected.includes("classes");
        return <Pressable key={key} accessibilityRole="checkbox" accessibilityLabel={option.label} accessibilityHint={option.description} accessibilityState={{ checked, disabled: locked }} disabled={locked}
          onPress={() => onChange(checked ? selected.filter(item => item !== key) : [...selected, key])}
          style={{ minHeight: 56, padding: 10, gap: 12, borderRadius: radius.internal, flexDirection: "row", alignItems: "flex-start", opacity: locked ? 0.72 : 1 }}>
          <GoAtletaIcon name={checked ? "checkbox" : "square"} size={20} color={checked ? colors.successText : colors.muted} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{option.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{option.description}</Text>
            {needsClasses ? <Text style={{ color: colors.muted, fontSize: 12 }}>Para usar, libere também o acesso a Turmas.</Text> : null}
            {protectedPermission && !admin ? <Text style={{ color: colors.muted, fontSize: 12 }}>Mantida para preservar seu acesso à gestão.</Text> : null}
          </View>
        </Pressable>;
      })}
    </View>)}
  </View>;
}
