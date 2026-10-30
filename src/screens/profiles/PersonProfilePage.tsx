import { PageBreadcrumbHeader } from "../../components/ui/PageBreadcrumbHeader";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Image, Platform, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import type { ScrollViewProps } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { OrgClass } from "../../api/members";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { formatClassAssignmentMeta } from "../coordination/application/class-assignment-meta";
import { compactUiMetrics as metrics } from "../../theme/tokens";
import { responsiveBreakpoints } from "../../ui/responsive-layout";

/** Animate the persistent container, without remounting forms or delaying tab selection. */
function ProfileTabContent({ tab, children }: { tab: string; children: ReactNode }) {
  const element = useRef<View>(null);
  const [progress] = useState(() => new Animated.Value(1));
  const previousTab = useRef(tab);
  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    if (Platform.OS === "web") {
      const node = element.current as unknown as HTMLElement | null;
      const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (preference.matches || !node?.animate) return;
      const animation = node.animate(
        [{ opacity: 0.65, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 180, easing: "ease-out" },
      );
      const cancel = () => animation.cancel();
      preference.addEventListener("change", cancel);
      return () => { animation.cancel(); preference.removeEventListener("change", cancel); };
    }
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active || reduced) return;
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
    return () => { active = false; progress.stopAnimation(); progress.setValue(1); };
  }, [tab, progress]);
  return <Animated.View ref={element} testID="profile-tab-content" style={Platform.OS === "web" ? undefined : { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>{children}</Animated.View>;
}

type Activity = { id: string; title: string; detail: string; date: string };
export type PersonProfilePageProps = {
  density?: "default" | "compact";
  context?: string;
  joinedLabel?: string;
  summary?: ReactNode;
  overviewContent?: ReactNode;
  financeContent?: ReactNode;
  settingsContent?: ReactNode;
  accessContent?: ReactNode;
  classesContent?: ReactNode;
  selectedTab?: string;
  onTabChange?: (tab: string) => void;
  refreshControl?: ScrollViewProps["refreshControl"];
  aboutItems?: { label: string; value?: string | null }[];
  testID?: string;
  name: string;
  onNameChange?: (name: string) => void;
  role: string;
  roleControl?: ReactNode;
  organizationName: string;
  workspaceControl?: ReactNode;
  email?: string | null;
  photoUri?: string | null;
  presence?: "online" | "offline" | "unknown";
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
  manageClassesLabel?: string;
  onMessage?: () => void;
};

export function EditableProfileName({ name, onChange, color, fontSize }: {
  name: string; onChange: (name: string) => void; color: string; fontSize: number;
}) {
  const [editing, setEditing] = useState(false);
  const original = useRef(name);
  const style = { color, fontSize, fontWeight: "700" as const };
  return editing ? <TextInput
    accessibilityLabel="Editar nome do perfil"
    autoFocus selectTextOnFocus value={name} onChangeText={onChange}
    onBlur={() => { if (!name.trim()) onChange(original.current); setEditing(false); }}
    onSubmitEditing={() => { if (!name.trim()) onChange(original.current); setEditing(false); }}
    onKeyPress={event => { if (event.nativeEvent.key === "Escape") { event.stopPropagation(); onChange(original.current); setEditing(false); } }}
    returnKeyType="done"
    style={[style, { minWidth: 180, maxWidth: "100%", flexShrink: 1, padding: 0, borderWidth: 0, borderRadius: 0, backgroundColor: "transparent" }, Platform.OS === "web" ? { outlineStyle: "none" } as never : null]}
  /> : <Pressable accessibilityRole="button" accessibilityLabel="Editar nome do perfil" suppressWebHoverFeedback disableWebPressScale onPress={() => { original.current = name; setEditing(true); }}>
    <Text style={[style, { textDecorationLine: "underline" }]}>{name}</Text>
  </Pressable>;
}

/** Person-first presentation. Callers own scoped reads and authorized actions. */
export function PersonProfilePage(props: PersonProfilePageProps) {
  const { colors, mode } = useAppTheme();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState("overview");
  const selectedTab = props.selectedTab ?? tab;
  const activeTab = (selectedTab === "access" && !props.accessContent) || (selectedTab === "finance" && !props.financeContent) || (selectedTab === "settings" && (!props.ownProfile || !props.settingsContent)) ? "overview" : selectedTab;
  const selectTab = (next: string) => { setTab(next); props.onTabChange?.(next); };
  const compact = width < responsiveBreakpoints.workspace;
  const dense = props.density === "compact";
  const cardPadding = dense && compact ? 10 : 12;
  const sectionGap = dense ? metrics.gap : 12;
  const avatarSize = compact ? 56 : 64;
  // Colors and court artwork from the approved profile mockup.
  const coverColor = mode === "light" ? "#DCE5EF" : "#223450";
  const avatarColor = "#B8C9DA";
  const split = width >= 1200;
  const presenceLabel = props.presence === "online" ? "Online nesta instituição" : props.presence === "offline" ? "Offline" : "Status indisponível";
  const initials = props.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14 };
  const action = (label: string, onPress: () => void, primary = false, iconOnly = false) => {
    const content = <>
      <GoAtletaIcon name={primary ? props.onEditProfile ? "pencil" : "shield" : "message"} size={dense ? metrics.iconSize : compact ? 14 : 16} color={!dense && primary ? colors.primaryText : colors.text} />
      {!iconOnly ? <Text style={{ color: !dense && primary ? colors.primaryText : colors.text, fontSize: dense ? metrics.bodyFontSize : compact ? 11 : 12, fontWeight: "600" }}>{label}</Text> : null}
    </>;
    return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} suppressWebHoverFeedback={dense} disableWebPressScale={dense} style={{ flexShrink: 0, minWidth: metrics.touchTarget, minHeight: metrics.touchTarget, paddingHorizontal: dense ? 0 : compact ? 8 : 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: metrics.gap, justifyContent: "center", borderWidth: dense ? 0 : 1, borderColor: primary ? colors.primaryBg : colors.border, backgroundColor: dense ? "transparent" : primary ? colors.primaryBg : colors.card }}>
      {dense ? state => {
        const feedback = state as typeof state & { hovered?: boolean; focused?: boolean };
        return <View pointerEvents="none" style={{ minHeight: metrics.controlHeight, paddingHorizontal: metrics.gap, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: metrics.smallGap, backgroundColor: feedback.pressed || feedback.hovered || feedback.focused ? colors.inputBg : colors.secondaryBg }}>{content}</View>;
      } : content}
    </Pressable>;
  };
  const classesContent = (
    <View style={{ ...card, padding: cardPadding, gap: metrics.gap }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: dense ? metrics.bodyFontSize : metrics.titleFontSize, lineHeight: dense ? metrics.bodyLineHeight : undefined, fontWeight: "700" }}>Turmas</Text>
        {props.onManageClasses ? <Pressable accessibilityRole="button" accessibilityLabel={props.manageClassesLabel ?? "Gerenciar turma do atleta"} onPress={props.onManageClasses} suppressWebHoverFeedback style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }}><Text style={{ color: colors.text, fontSize: metrics.metadataFontSize }}>{props.manageClassesLabel ?? "Gerenciar turma"}</Text></Pressable> : null}
      </View>
      {props.loading ? <Text style={{ color: colors.muted }}>Carregando turmas...</Text> : props.error ? <Text style={{ color: colors.dangerText }}>Não foi possível carregar as turmas. Tente novamente.</Text> : props.classes.length ? props.classes.map(item => (
        <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: dense ? metrics.gap : 12, paddingVertical: dense ? metrics.smallGap : 8 }}>
          <View style={{ width: metrics.controlHeight, height: metrics.controlHeight, borderRadius: 10, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center" }}><GoAtletaIcon name="classes" size={metrics.iconSize} color={colors.muted} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "600" }}>{item.name}</Text>
            <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize }}>{formatClassAssignmentMeta(item)}</Text>
          </View>
        </View>
      )) : <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>Nenhuma turma vinculada.</Text>}
    </View>
  );
  const activityContent = props.activity ? (
    <View style={{ ...card, padding: cardPadding, gap: metrics.gap }}>
      <Text style={{ color: colors.text, fontSize: dense ? metrics.bodyFontSize : metrics.titleFontSize, fontWeight: "700" }}>Atividade recente</Text>
      {props.activity.length ? props.activity.map(item => (
        <View key={item.id} style={{ gap: 4, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 14 }}>
          <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "600" }}>{item.title}</Text>
          <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize }}>{item.detail}</Text>
          <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize }}>{item.date}</Text>
        </View>
      )) : <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>Nenhuma atividade registrada nos últimos 7 dias.</Text>}
    </View>
  ) : null;
  return (
    <ScrollView refreshControl={props.refreshControl} testID={`${props.testID ?? "staff-profile"}-scroll`} style={{ flex: 1, minHeight: 0, ...(Platform.OS === "web" ? { overflowY: "scroll", scrollbarGutter: "stable", scrollbarWidth: "thin" } as any : {}) }} contentContainerStyle={{ padding: compact ? 16 : 24, paddingBottom: 100 }}>
      <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", gap: sectionGap }}>
        <PageBreadcrumbHeader title={props.ownProfile ? "Meu perfil" : "Perfil"} context={props.context ?? "Equipe"} breadcrumbs={props.ownProfile ? [] : undefined} onBack={props.onBack} backLabel="Voltar" />
        <View style={{ ...card, overflow: "hidden" }}>
          <View testID={`${props.testID ?? "staff-profile"}-cover`} style={{ height: compact ? 72 : 84, backgroundColor: coverColor, overflow: "hidden" }}>
            <Svg width={compact ? 290 : 420} height={330} viewBox="0 0 420 330" fill="none" style={{ position: "absolute", right: compact ? -20 : 50, top: -120, transform: [{ rotate: "-15deg" }] }}>
              <Rect x="40" y="50" width="340" height="230" rx="2" stroke="#506786" strokeWidth="2" opacity="0.7" />
              <Path d="M210 50v230M153 50v230M267 50v230M15 165h390" stroke="#506786" strokeWidth="2" opacity="0.7" />
              <Circle cx="350" cy="250" r="46" stroke="#506786" strokeWidth="2" opacity="0.7" />
              <Path d="M315 220q60 0 55 60M309 248q20 30 68 23M334 207q-8 46 29 85" stroke="#506786" strokeWidth="2" opacity="0.7" />
            </Svg>
            {!compact ? <Text style={{ position: "absolute", right: 24, bottom: 18, color: mode === "light" ? colors.muted : "#B6C3D7", fontSize: 11, letterSpacing: 1.4 }}>GO ATLETA</Text> : null}
          </View>
          <View style={{ paddingHorizontal: dense ? cardPadding : compact ? 12 : 16, paddingBottom: dense ? metrics.gap : 12, gap: 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "nowrap" }}>
              <Pressable accessibilityRole={props.onEditPhoto ? "button" : undefined} accessibilityLabel={props.onEditPhoto ? "Editar foto do perfil" : `Avatar de ${props.name}`} onPress={props.onEditPhoto} disabled={!props.onEditPhoto} testID={`${props.testID ?? "staff-profile"}-avatar`} suppressWebHoverFeedback disableWebPressScale style={{ flexShrink: 0, width: avatarSize, height: avatarSize, marginTop: -24, borderRadius: avatarSize / 2, borderWidth: 5, borderColor: colors.card, backgroundColor: avatarColor, alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                {props.photoUri ? <Image source={{ uri: props.photoUri }} style={{ width: avatarSize - 10, height: avatarSize - 10, borderRadius: (avatarSize - 10) / 2 }} /> : <Text style={{ color: "#1C3045", fontSize: compact ? 18 : 20, fontWeight: "700" }}>{initials}</Text>}
                {props.onEditPhoto ? <View style={{ position: "absolute", bottom: -3, right: -3, width: 28, height: 28, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center", borderRadius: 14 }}><GoAtletaIcon name="camera" size={12} color={colors.primaryText} /></View> : null}
                {props.presence ? <View accessibilityRole="image" accessibilityLabel={presenceLabel} {...(Platform.OS === "web" ? { title: presenceLabel } : {})} testID="profile-presence" style={{ position: "absolute", right: props.onEditPhoto ? undefined : -1, left: props.onEditPhoto ? -1 : undefined, bottom: -1, width: 20, height: 20, borderRadius: 10, borderWidth: 4, borderColor: colors.card, backgroundColor: props.presence === "online" ? colors.successText : colors.muted }}>
                  {props.presence === "unknown" ? <View style={{ position: "absolute", inset: 2, borderRadius: 6, backgroundColor: colors.card }} /> : null}
                </View> : null}
              </Pressable>
              <View testID={`${props.testID ?? "staff-profile"}-actions`} style={{ flexDirection: "row", flexShrink: 0, marginLeft: "auto", gap: compact ? 6 : 8, paddingTop: 8, flexWrap: "nowrap" }}>
                {props.onEditProfile ? action("Editar perfil", props.onEditProfile, true) : props.onManageAccess ? action("Gerenciar acesso", props.onManageAccess, true) : null}
                {props.onMessage ? action("Mensagem", props.onMessage, false, compact) : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: dense ? metrics.gap : 10, alignItems: "center", flexWrap: "wrap", marginTop: dense ? metrics.gap : 12 }}><>{props.ownProfile && props.onNameChange ? <EditableProfileName name={props.name} onChange={props.onNameChange} color={colors.text} fontSize={compact ? metrics.titleFontSize : 18} /> : <Text style={{ color: colors.text, fontSize: compact ? metrics.titleFontSize : 18, fontWeight: "700" }}>{props.name}</Text>}</>{props.ownProfile && props.roleControl ? props.roleControl : <Text style={{ color: colors.muted, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: metrics.metadataFontSize }}>{props.role}</Text>}</View>
            {props.ownProfile && props.workspaceControl ? props.workspaceControl : <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize, marginTop: 4 }}>{props.organizationName}</Text>}
            {props.locationLabel || (props.joinedAt && Number.isFinite(Date.parse(props.joinedAt))) ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: dense ? metrics.gap : 18, rowGap: dense ? metrics.smallGap : 8, marginTop: dense ? metrics.gap : 12 }}>
              {props.locationLabel ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><GoAtletaIcon name="location" size={13} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize }}>{props.locationLabel}</Text></View> : null}
              {props.joinedAt && Number.isFinite(Date.parse(props.joinedAt)) ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><GoAtletaIcon name="calendar" size={13} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize }}>{props.joinedLabel ?? "Na equipe desde"} {new Date(props.joinedAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text></View> : null}
            </View> : null}
            {props.summary ?? (!props.loading && !props.error ? <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, marginTop: 12 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: metrics.titleFontSize }}>{props.classes.length}</Text> turmas atribuídas</Text> : null)}
          </View>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
            {[{ id: "overview", label: "Visão geral" }, { id: "classes", label: "Turmas" }, ...(props.accessContent ? [{ id: "access", label: "Acesso" }] : []), ...(props.activity ? [{ id: "activity", label: "Atividade" }] : []), ...(props.financeContent ? [{ id: "finance", label: "Financeiro" }] : [])].map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: activeTab === item.id }} onPress={() => selectTab(item.id)} suppressWebHoverFeedback style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: activeTab === item.id ? colors.primaryBg : "transparent" }}><Text style={{ fontSize: metrics.metadataFontSize, color: activeTab === item.id ? colors.text : colors.muted, fontWeight: "600" }}>{item.label}</Text></Pressable>)}
            {props.ownProfile && (props.settingsContent || props.onSettings) ? <Pressable accessibilityRole="tab" accessibilityLabel="Configurações" accessibilityState={{ selected: activeTab === "settings" }} onPress={() => { if (props.settingsContent) selectTab("settings"); props.onSettings?.(); }} suppressWebHoverFeedback style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: activeTab === "settings" ? colors.primaryBg : "transparent" }}><Text style={{ fontSize: metrics.metadataFontSize, color: activeTab === "settings" ? colors.text : colors.muted, fontWeight: "600" }}>Configurações</Text></Pressable> : null}
          </View>
        </View>
        <ProfileTabContent tab={activeTab}>{activeTab === "access" ? props.accessContent : activeTab === "settings" ? props.settingsContent : <View style={{ flexDirection: split && activeTab === "overview" ? "row" : "column", gap: sectionGap, alignItems: "flex-start" }}>
          <View style={{ flex: 1, width: "100%", minWidth: 0, gap: sectionGap }}>{activeTab === "finance" ? props.financeContent : <>{activeTab !== "activity" ? (props.classesContent ?? classesContent) : null}{activeTab === "overview" ? props.overviewContent : null}{activeTab !== "classes" ? activityContent : null}</>}</View>
          {activeTab === "overview" ? <View style={{ ...card, padding: cardPadding, gap: metrics.gap, width: split ? 300 : "100%" }}><Text style={{ color: colors.text, fontSize: dense ? metrics.bodyFontSize : metrics.titleFontSize, lineHeight: dense ? metrics.bodyLineHeight : undefined, fontWeight: "700" }}>Sobre</Text>{(props.aboutItems ?? [{ label: "Instituição", value: props.organizationName }, { label: "Função", value: props.role }, { label: "Contato", value: props.email }, { label: "Último acesso", value: props.lastAccess }]).filter(item => item.value).map(item => <View key={item.label} style={{ gap: dense ? metrics.smallGap : 5 }}><Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize }}>{item.label}</Text><Text selectable style={{ color: colors.text, fontSize: metrics.bodyFontSize }}>{item.value}</Text></View>)}</View> : null}
        </View>}</ProfileTabContent>
      </View>
    </ScrollView>
  );
}
