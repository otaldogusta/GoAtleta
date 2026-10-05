import { PageBreadcrumbHeader } from "../../components/ui/PageBreadcrumbHeader";
import { useState, type ReactNode } from "react";
import { Image, Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { OrgClass } from "../../api/members";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { formatClassAssignmentMeta } from "../coordination/application/class-assignment-meta";

type Activity = { id: string; title: string; detail: string; date: string };
export type PersonProfilePageProps = {
  context?: string;
  joinedLabel?: string;
  summary?: ReactNode;
  overviewContent?: ReactNode;
  financeContent?: ReactNode;
  aboutItems?: { label: string; value?: string | null }[];
  testID?: string;
  name: string;
  role: string;
  organizationName: string;
  email?: string | null;
  photoUri?: string | null;
  locationLabel?: string | null;
  joinedAt?: string;
  lastAccess?: string;
  classes: OrgClass[];
  loading?: boolean;
  error?: boolean;
  activity?: Activity[];
  ownProfile?: boolean;
  onBack: () => void;
  onEditProfile?: () => void;
  onEditPhoto?: () => void;
  onSettings?: () => void;
  onManageAccess?: () => void;
  onManageClasses?: () => void;
  onMessage?: () => void;
};

/** Person-first presentation. Callers own scoped reads and authorized actions. */
export function PersonProfilePage(props: PersonProfilePageProps) {
  const { colors, mode } = useAppTheme();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState("overview");
  const activeTab = tab === "finance" && !props.financeContent ? "overview" : tab;
  const compact = width < 600;
  const avatarSize = compact ? 76 : 88;
  // Colors and court artwork from the approved profile mockup.
  const coverColor = mode === "light" ? "#DCE5EF" : "#223450";
  const avatarColor = "#B8C9DA";
  const split = width >= 1200;
  const initials = props.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14 };
  const action = (label: string, onPress: () => void, primary = false, iconOnly = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flexShrink: 0, minWidth: 40, minHeight: 40, paddingHorizontal: compact ? 10 : 14, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", borderWidth: 1, borderColor: primary ? colors.primaryBg : colors.border, backgroundColor: primary ? colors.primaryBg : colors.card }}>
      <GoAtletaIcon name={primary ? props.onEditProfile ? "pencil" : "shield" : "message"} size={compact ? 14 : 16} color={primary ? colors.primaryText : colors.text} />
      {!iconOnly ? <Text style={{ color: primary ? colors.primaryText : colors.text, fontSize: compact ? 11 : 12, fontWeight: "600" }}>{label}</Text> : null}
    </Pressable>
  );
  const classesContent = (
    <View style={{ ...card, padding: 18, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Turmas</Text>
        {props.onManageClasses ? <Pressable accessibilityRole="button" accessibilityLabel="Gerenciar turma do atleta" onPress={props.onManageClasses} suppressWebHoverFeedback style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }}><Text style={{ color: colors.text, fontSize: 12 }}>Gerenciar turma</Text></Pressable> : null}
      </View>
      {props.loading ? <Text style={{ color: colors.muted }}>Carregando turmas...</Text> : props.error ? <Text style={{ color: colors.dangerText }}>Não foi possível carregar as turmas. Tente novamente.</Text> : props.classes.length ? props.classes.map(item => (
        <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center" }}><GoAtletaIcon name="classes" size={18} color={colors.muted} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{item.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{formatClassAssignmentMeta(item)}</Text>
          </View>
        </View>
      )) : <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhuma turma vinculada.</Text>}
    </View>
  );
  const activityContent = props.activity ? (
    <View style={{ ...card, padding: 18, gap: 18 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Atividade recente</Text>
      {props.activity.length ? props.activity.map(item => (
        <View key={item.id} style={{ gap: 4, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 14 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{item.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.detail}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.date}</Text>
        </View>
      )) : <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhuma atividade registrada nos últimos 7 dias.</Text>}
    </View>
  ) : null;
  return (
    <ScrollView testID={`${props.testID ?? "staff-profile"}-scroll`} style={{ flex: 1, minHeight: 0, ...(Platform.OS === "web" ? { overflowY: "scroll", scrollbarGutter: "stable", scrollbarWidth: "thin" } as any : {}) }} contentContainerStyle={{ padding: compact ? 12 : 24, paddingBottom: 100 }}>
      <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", gap: 20 }}>
        <PageBreadcrumbHeader title="Perfil" context={props.context ?? (props.ownProfile ? "Meu perfil" : "Equipe")} onBack={props.onBack} backLabel="Voltar" />
        <View style={{ ...card, overflow: "hidden" }}>
          <View testID={`${props.testID ?? "staff-profile"}-cover`} style={{ height: compact ? 104 : width < 850 ? 108 : 124, backgroundColor: coverColor, overflow: "hidden" }}>
            <Svg width={compact ? 290 : 420} height={330} viewBox="0 0 420 330" fill="none" style={{ position: "absolute", right: compact ? -20 : 50, top: -120, transform: [{ rotate: "-15deg" }] }}>
              <Rect x="40" y="50" width="340" height="230" rx="2" stroke="#506786" strokeWidth="2" opacity="0.7" />
              <Path d="M210 50v230M153 50v230M267 50v230M15 165h390" stroke="#506786" strokeWidth="2" opacity="0.7" />
              <Circle cx="350" cy="250" r="46" stroke="#506786" strokeWidth="2" opacity="0.7" />
              <Path d="M315 220q60 0 55 60M309 248q20 30 68 23M334 207q-8 46 29 85" stroke="#506786" strokeWidth="2" opacity="0.7" />
            </Svg>
            {!compact ? <Text style={{ position: "absolute", right: 24, bottom: 18, color: mode === "light" ? colors.muted : "#B6C3D7", fontSize: 11, letterSpacing: 1.4 }}>GO ATLETA</Text> : null}
          </View>
          <View style={{ paddingHorizontal: compact ? 20 : 24, paddingBottom: 20, gap: 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: compact ? 8 : 20, flexWrap: "nowrap" }}>
              <Pressable accessibilityRole={props.onEditPhoto ? "button" : undefined} accessibilityLabel={props.onEditPhoto ? "Editar foto do perfil" : `Avatar de ${props.name}`} onPress={props.onEditPhoto} disabled={!props.onEditPhoto} testID={`${props.testID ?? "staff-profile"}-avatar`} suppressWebHoverFeedback disableWebPressScale style={{ flexShrink: 0, width: avatarSize, height: avatarSize, marginTop: compact ? -32 : -36, borderRadius: avatarSize / 2, borderWidth: 5, borderColor: colors.card, backgroundColor: avatarColor, alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                {props.photoUri ? <Image source={{ uri: props.photoUri }} style={{ width: avatarSize - 10, height: avatarSize - 10, borderRadius: (avatarSize - 10) / 2 }} /> : <Text style={{ color: "#1C3045", fontSize: compact ? 24 : 27, fontWeight: "700" }}>{initials}</Text>}
                {props.onEditPhoto ? <View style={{ position: "absolute", bottom: -3, right: -3, width: 28, height: 28, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center", borderRadius: 14 }}><GoAtletaIcon name="camera" size={12} color={colors.primaryText} /></View> : null}
              </Pressable>
              <View testID={`${props.testID ?? "staff-profile"}-actions`} style={{ flexDirection: "row", flexShrink: 0, marginLeft: "auto", gap: compact ? 6 : 8, paddingTop: compact ? 12 : 14, flexWrap: "nowrap" }}>
                {props.onEditProfile ? action("Editar perfil", props.onEditProfile, true) : props.onManageAccess ? action("Gerenciar acesso", props.onManageAccess, true) : null}
                {props.onMessage ? action("Mensagem", props.onMessage, false, compact) : null}
                {props.onSettings ? <Pressable accessibilityRole="button" accessibilityLabel="Configurações" onPress={props.onSettings} style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}><GoAtletaIcon name="management" size={18} color={colors.text} /></Pressable> : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}><Text style={{ color: colors.text, fontSize: compact ? 22 : 24, fontWeight: "700" }}>{props.name}</Text><Text style={{ color: colors.muted, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12 }}>{props.role}</Text></View>
            <Text style={{ color: colors.muted, fontSize: compact ? 13 : 14, marginTop: 4 }}>{props.organizationName}</Text>
            {props.locationLabel || (props.joinedAt && Number.isFinite(Date.parse(props.joinedAt))) ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 18, rowGap: 8, marginTop: 12 }}>
              {props.locationLabel ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><GoAtletaIcon name="location" size={13} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12 }}>{props.locationLabel}</Text></View> : null}
              {props.joinedAt && Number.isFinite(Date.parse(props.joinedAt)) ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><GoAtletaIcon name="calendar" size={13} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12 }}>{props.joinedLabel ?? "Na equipe desde"} {new Date(props.joinedAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text></View> : null}
            </View> : null}
            {props.summary ?? (!props.loading && !props.error ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: compact ? 16 : 20 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>{props.classes.length}</Text> turmas atribuídas</Text> : null)}
          </View>
          <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
            {[{ id: "overview", label: "Visão geral" }, { id: "classes", label: "Turmas" }, ...(props.activity ? [{ id: "activity", label: "Atividade" }] : []), ...(props.financeContent ? [{ id: "finance", label: "Financeiro" }] : [])].map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: activeTab === item.id }} onPress={() => setTab(item.id)} suppressWebHoverFeedback style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: activeTab === item.id ? colors.primaryBg : "transparent" }}><Text style={{ fontSize: 12, color: activeTab === item.id ? colors.text : colors.muted, fontWeight: "600" }}>{item.label}</Text></Pressable>)}
          </View>
        </View>
        <View style={{ flexDirection: split && activeTab === "overview" ? "row" : "column", gap: 20, alignItems: "flex-start" }}>
          <View style={{ flex: 1, width: "100%", minWidth: 0, gap: 20 }}>{activeTab === "finance" ? props.financeContent : <>{activeTab !== "activity" ? classesContent : null}{activeTab === "overview" ? props.overviewContent : null}{activeTab !== "classes" ? activityContent : null}</>}</View>
          {activeTab === "overview" ? <View style={{ ...card, padding: 18, gap: 16, width: split ? 300 : "100%" }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Sobre</Text>{(props.aboutItems ?? [{ label: "Instituição", value: props.organizationName }, { label: "Função", value: props.role }, { label: "Contato", value: props.email }, { label: "Último acesso", value: props.lastAccess }]).filter(item => item.value).map(item => <View key={item.label} style={{ gap: 5 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{item.label}</Text><Text selectable style={{ color: colors.text, fontSize: 14 }}>{item.value}</Text></View>)}</View> : null}
        </View>
      </View>
    </ScrollView>
  );
}
