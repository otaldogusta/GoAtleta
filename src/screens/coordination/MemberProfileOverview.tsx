import { Text, View } from "react-native";

import type { OrgClass, OrgMember } from "../../api/members";
import { radius } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { formatClassAssignmentMeta, groupClassAssignments } from "./application/class-assignment-meta";
import { formatMemberLastAccess } from "./application/member-last-access";

type Props = {
  member: OrgMember;
  organizationName: string;
  assignedClasses: OrgClass[];
  loading: boolean;
  onManageAccess: () => void;
};

export function MemberProfileOverview({ member, organizationName, assignedClasses, loading, onManageAccess }: Props) {
  const { colors } = useAppTheme();
  const initials = member.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const role = member.roleLevel >= 50 ? "Coordenação" : member.roleLevel >= 10 ? "Professor" : "Estagiário";

  return (
    <View style={{ gap: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.primaryText, fontSize: 18, fontWeight: "700" }}>{initials || "US"}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{member.displayName}</Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>{role} · {organizationName}</Text>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        {member.email ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Contato</Text>
            <Text selectable style={{ color: colors.text, fontSize: 14 }}>{member.email}</Text>
          </View>
        ) : null}
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Último acesso</Text>
          <Text style={{ color: colors.text, fontSize: 14 }}>{formatMemberLastAccess(member.lastAccessAt)}</Text>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Turmas{loading ? "" : ` · ${assignedClasses.length}`}</Text>
          <Pressable accessibilityRole="button" onPress={onManageAccess} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center", borderRadius: radius.internal }}>
            <Text style={{ color: colors.infoText, fontSize: 12, fontWeight: "600" }}>Gerenciar acesso</Text>
          </Pressable>
        </View>
        {loading ? <Text style={{ color: colors.muted, fontSize: 14 }}>Carregando turmas...</Text> : assignedClasses.length ? (
          groupClassAssignments(assignedClasses).map((group) => (
            <View key={group.unit} style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{group.unit}</Text>
              {group.classes.map((item) => (
                <View key={item.id} style={{ paddingVertical: 10, gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{formatClassAssignmentMeta({ ...item, unit: "" })}</Text>
                </View>
              ))}
            </View>
          ))
        ) : <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhuma turma vinculada.</Text>}
      </View>
    </View>
  );
}
