import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { compactUiMetrics, radius } from "../../theme/tokens";
import { APP_PRODUCT_LABELS } from "../../config/brand";
import { useAppTheme } from "../../ui/app-theme";
import { PlatformAction as Button, PlatformMetric, platformHighlighted } from "./PlatformUiControls";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useSaveToast } from "../../ui/save-toast";
import { useContainerResponsiveLayout } from "../../ui/use-container-responsive-layout";
import {
  platformListInstitutions,
  platformUpdateInstitutionAccount,
  type PlatformCommercialStatus,
  type PlatformInstitution,
  type PlatformProduct,
} from "../../api/platform-institutions";

type InstitutionStatus = "evaluation" | "active" | "paused" | "cancelled";
type Institution = {
  id: string;
  name: string;
  responsible: string;
  email: string;
  product: PlatformProduct;
  period: string;
  status: InstitutionStatus;
  users: number;
  note: string;
};

const labels = {
  evaluation: "Em avaliação",
  active: "Ativa",
  paused: "Suspensa",
  cancelled: "Removida",
} as const;
const productLabels = APP_PRODUCT_LABELS;
const formatDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : null;
const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-0000-4000-8000-000000000000`;
const mapPlatformInstitution = (item: PlatformInstitution): Institution => ({
  id: item.organizationId,
  name: item.organizationName,
  responsible: item.responsibleName,
  email: item.responsibleEmail,
  product: item.product,
  period:
    item.lifecycleStatus === "evaluation"
      ? `Avaliação${formatDate(item.evaluationEndsAt) ? ` até ${formatDate(item.evaluationEndsAt)}` : ""}`
      : item.renewsAt
        ? `Renova em ${formatDate(item.renewsAt)}`
        : "Sem renovação definida",
  status: item.lifecycleStatus,
  users: item.usersCount,
  note: item.commercialNote,
});

function StatusPill({ status }: { status: InstitutionStatus }) {
  const { colors } = useAppTheme();
  const tone =
    status === "active"
      ? "success"
      : status === "evaluation"
        ? "warning"
        : "danger";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors[`${tone}Border`],
        backgroundColor: colors[`${tone}Bg`],
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          color: colors[`${tone}Text`],
          fontSize: 11,
          fontWeight: "600",
        }}
      >
        {labels[status]}
      </Text>
    </View>
  );
}

export function PlatformDashboard() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { showSaveToast } = useSaveToast();
  const { confirm } = useConfirmDialog();
  const { width } = useWindowDimensions();
  const wide = width >= 1200;
  const { containerRef: listRef, onLayout: onListLayout, measuredWidth: listWidth, layout } = useContainerResponsiveLayout("dashboard");
  const usesTable = listWidth >= 760;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | InstitutionStatus>("all");
  const [selectedId, setSelectedId] = useState("");
  const [items, setItems] = useState<Institution[]>([]);
  const [sourceItems, setSourceItems] = useState<PlatformInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editProduct, setEditProduct] = useState<PlatformProduct>("goatleta");
  const [editStatus, setEditStatus] = useState<InstitutionStatus>("active");
  const [editCommercialStatus, setEditCommercialStatus] =
    useState<PlatformCommercialStatus>("ok");
  const [editNote, setEditNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await platformListInstitutions();
      setSourceItems(loaded);
      setItems(loaded.map(mapPlatformInstitution));
      setSelectedId((current) =>
        loaded.some((item) => item.organizationId === current)
          ? current
          : (loaded[0]?.organizationId ?? ""),
      );
    } catch (error) {
      setSourceItems([]);
      setItems([]);
      setSelectedId("");
      showSaveToast({
        variant: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as instituições.",
      });
    } finally {
      setLoading(false);
    }
  }, [showSaveToast]);

  useEffect(() => {
    // Reconcile the dashboard with the remote institution lifecycle records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (filter === "all"
            ? item.status !== "cancelled"
            : item.status === filter) &&
          `${item.name} ${item.responsible} ${productLabels[item.product]}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [filter, items, query],
  );
  const selected = items.find((item) => item.id === selectedId) ??
    filtered[0] ??
    items[0] ?? {
      id: "",
      name: loading ? "Carregando…" : "Nenhuma instituição",
      responsible: "—",
      email: "",
      product: "goatleta" as const,
      period: "—",
      status: "evaluation" as const,
      users: 0,
      note: "",
    };
  const selectedSource = sourceItems.find(
    (item) => item.organizationId === selected?.id,
  );
  const startEditing = () => {
    if (!selected.id) return;
    setEditProduct(selected.product);
    setEditStatus(selected.status);
    setEditCommercialStatus(selectedSource?.commercialStatus ?? "ok");
    setEditNote(selected.note);
    setEditing(true);
  };
  const saveInstitution = async () => {
    if (!selected.id || busy) return;
    setBusy(true);
    try {
      if (!selectedSource) {
        setItems((current) =>
          current.map((item) =>
            item.id === selected.id
              ? {
                  ...item,
                  product: editProduct,
                  status: editStatus,
                  note: editNote.trim(),
                }
              : item,
          ),
        );
        setEditing(false);
        showSaveToast({
          variant: "success",
          message: "Prévia local atualizada.",
        });
        return;
      }
      await platformUpdateInstitutionAccount({
        organizationId: selected.id,
        product: editProduct,
        lifecycleStatus: editStatus,
        commercialStatus: editCommercialStatus,
        evaluationEndsAt: selectedSource.evaluationEndsAt,
        activatedAt: selectedSource.activatedAt,
        renewsAt: selectedSource.renewsAt,
        commercialNote: editNote.trim(),
        idempotencyKey: createIdempotencyKey(),
      });
      await load();
      setEditing(false);
      showSaveToast({ variant: "success", message: "Instituição atualizada." });
    } catch (error) {
      showSaveToast({
        variant: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a instituição.",
      });
    } finally {
      setBusy(false);
    }
  };
  const suspendInstitution = async () => {
    if (
      !selected.id ||
      busy ||
      selected.status === "cancelled" ||
      selected.status === "paused"
    )
      return;

    await confirm({
      title: "Suspender instituição?",
      message:
        "Ela ficará na aba Suspensas, com histórico e dados preservados para reativação posterior. Registre o motivo na nota comercial.",
      confirmLabel: "Suspender instituição",
      cancelLabel: "Cancelar",
      loadingLabel: "Suspendendo…",
      tone: "danger",
      onConfirm: async () => {
        if (!selectedSource) {
          setItems((current) =>
            current.map((item) =>
              item.id === selected.id ? { ...item, status: "paused" } : item,
            ),
          );
        } else {
          await platformUpdateInstitutionAccount({
            organizationId: selected.id,
            product: selectedSource.product,
            lifecycleStatus: "paused",
            commercialStatus: selectedSource.commercialStatus,
            evaluationEndsAt: selectedSource.evaluationEndsAt,
            activatedAt: selectedSource.activatedAt,
            renewsAt: selectedSource.renewsAt,
            commercialNote: selectedSource.commercialNote,
            idempotencyKey: createIdempotencyKey(),
          });
          await load();
        }

        setEditing(false);
        setFilter("paused");
        showSaveToast({
          variant: "success",
          message: "Instituição marcada como suspensa.",
        });
      },
    });
  };
  const metrics: [GoAtletaIconName, string, string, string][] = [
    [
      "organization",
      String(items.filter((item) => item.status === "active").length),
      "instituições ativas",
      colors.successText,
    ],
    [
      "time",
      String(items.filter((item) => item.status === "evaluation").length),
      "em avaliação",
      colors.warningText,
    ],
    [
      "calendar",
      String(
        sourceItems.filter(
          (item) =>
            item.renewsAt?.slice(0, 7) === new Date().toISOString().slice(0, 7),
        ).length,
      ),
      "renovações neste mês",
      colors.infoText,
    ],
    [
      "warningCircle",
      String(
        sourceItems.filter((item) => item.commercialStatus === "attention")
          .length,
      ),
      "em atenção comercial",
      colors.dangerText,
    ],
  ];

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenPageHeader
        title="Painel"
        subtitle="Operação SaaS das instituições"
        onBack={() => router.replace("/coord/dashboard")}
        horizontalBleed={0}
        fadeHeight={10}
        contentStyle={{
          paddingTop: Platform.OS === "web" ? 12 : 8,
          paddingBottom: 0,
        }}
        right={
          wide ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View
                style={{
                  width: 330,
                  minHeight: 50,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar instituições..."
                  placeholderTextColor={colors.placeholder}
                  style={{ minWidth: 0,
                    flex: 1,
                    minHeight: 48,
                    color: colors.inputText,
                    borderRadius: 0,
                  }}
                />
                <GoAtletaIcon name="search" size={17} color={colors.muted} />
              </View>
<Button label="Filtros" icon="options" onPress={() =>
                  showSaveToast({
                    variant: "info",
                    message: "Use as abas para filtrar as instituições.",
                  })} />
            </View>
          ) : null
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
      >
        <ResponsivePage variant="dashboard" gap={layout.density.pageGap}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: compactUiMetrics.gap }}>
            {metrics.map(([icon, value, label, color], index) => (
              <View key={label} style={{ flexGrow: 1, flexBasis: 128, minWidth: 0 }}>
                <PlatformMetric icon={icon} value={value} label={label} compactLabel={["Ativas", "Avaliação", "Renovações", "Atenção"][index]} color={color} compact={width < 768} />
              </View>
            ))}
          </View>
          <ResponsiveGrid
            columns={{ compact: "1", split: "8/4" }}
            gap={layout.density.pageGap}
            style={{ alignItems: "flex-start" }}
          >
            <View
              ref={listRef}
              onLayout={onListLayout}
              testID="platform-institution-list"
              style={{
                minWidth: 0,
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                overflow: "hidden",
              }}
            >
              <View style={{ padding: layout.density.cardPadding, gap: layout.density.sectionGap }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: compactUiMetrics.titleFontSize,
                    fontWeight: "900",
                  }}
                >
                  Instituições
                </Text>
                <View
                  style={{
                    flexDirection: usesTable ? "row" : "column",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <View
                    style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}
                  >
                    {(["all", "evaluation", "active", "paused", "cancelled"] as const).map(value => (
                      <Button key={value} onPress={() => setFilter(value)} selected={filter === value} label={value === "all" ? "Todas" : labels[value]} />
                    ))}
                  </View>
                  <View
                    style={{
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: usesTable ? 220 : "auto",
                      minWidth: 0,
                      width: usesTable ? undefined : "100%",
                      minHeight: 50,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                      paddingHorizontal: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <GoAtletaIcon
                      name="search"
                      size={16}
                      color={colors.muted}
                    />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Buscar instituição..."
                      placeholderTextColor={colors.placeholder}
                      style={{ minWidth: 0,
                        flex: 1,
                        minHeight: 48,
                        color: colors.inputText,
                        borderRadius: 0,
                      }}
                    />
                  </View>
                </View>
              </View>
              {usesTable ? (
                <View
                  style={{
                    minHeight: 38,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text
                    style={{
                      flex: 1.25,
                      color: colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    INSTITUIÇÃO
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    RESPONSÁVEL
                  </Text>
                  <Text
                    style={{
                      width: 90,
                      color: colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    PRODUTO
                  </Text>
                  <Text
                    style={{
                      width: 150,
                      color: colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    PERÍODO
                  </Text>
                  <Text
                    style={{
                      width: 100,
                      color: colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    STATUS
                  </Text>
                  <Text
                    style={{
                      width: 64,
                      color: colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    USUÁRIOS
                  </Text>
                </View>
              ) : null}
              {loading ? (
                <View
                  style={{
                    minHeight: 56,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Carregando instituições…
                  </Text>
                </View>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <View
                  style={{
                    minHeight: 56,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Nenhuma instituição encontrada.
                  </Text>
                </View>
              ) : null}
              {!loading &&
                filtered.map((item) => (
                  <Pressable suppressWebHoverFeedback disableWebPressScale
                    key={item.id}
                    onPress={() => setSelectedId(item.id)}
                    style={state => ({
                      minHeight: 52,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor:
                        selected.id === item.id
                          ? colors.successBg
                          : platformHighlighted(state) ? colors.secondaryBg : "transparent",
                      marginHorizontal: 4,
                      marginVertical: 2,
                      borderRadius: radius.internal,
                      paddingHorizontal: 8,
                      paddingVertical: 9,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    })}
                  >
                    <View
                      style={{
                        width: compactUiMetrics.controlHeight,
                        height: compactUiMetrics.controlHeight,
                        borderRadius: radius.full,
                        backgroundColor: colors.infoBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {item.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={{ flex: usesTable ? 1.25 : 1, minWidth: 0 }}
                    >
                      <Text
                        numberOfLines={usesTable ? 1 : 2}
                        style={{
                          color: colors.text,
                          fontSize: compactUiMetrics.bodyFontSize,
                          lineHeight: compactUiMetrics.bodyLineHeight,
                          fontWeight: "800",
                        }}
                      >
                        {item.name}
                      </Text>
                      {!usesTable ? (
                        <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
                          {item.responsible} · {productLabels[item.product]}
                        </Text>
                      ) : null}
                    </View>
                    {usesTable ? (
                      <>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            numberOfLines={1}
                            style={{ color: colors.text, fontSize: 12 }}
                          >
                            {item.responsible}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ color: colors.muted, fontSize: 10 }}
                          >
                            {item.email}
                          </Text>
                        </View>
                        <Text
                          style={{
                            width: 90,
                            color: colors.text,
                            fontSize: 12,
                          }}
                        >
                          {productLabels[item.product]}
                        </Text>
                        <Text
                          style={{
                            width: 150,
                            color: colors.muted,
                            fontSize: 11,
                          }}
                        >
                          {item.period}
                        </Text>
                      </>
                    ) : null}
                    <View style={{ width: usesTable ? 100 : undefined }}>
                      <StatusPill status={item.status} />
                    </View>
                    {usesTable ? (
                      <Text
                        style={{
                          width: 64,
                          color: colors.text,
                          fontSize: 12,
                          fontWeight: "800",
                          textAlign: "center",
                        }}
                      >
                        {item.users}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
            </View>
            <View
              style={{
                width: "100%",
                minWidth: 0,
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: layout.density.cardPadding,
                gap: compactUiMetrics.gap,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: compactUiMetrics.controlHeight,
                    height: compactUiMetrics.controlHeight,
                    borderRadius: radius.full,
                    backgroundColor: colors.infoBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GoAtletaIcon
                    name="organization"
                    size={compactUiMetrics.iconSize}
                    color={colors.infoText}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight,
                      fontWeight: "700",
                    }}
                  >
                    {selected.name}
                  </Text>
                  <StatusPill status={selected.status} />
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              {[
                ["Responsável", selected.responsible],
                ["Produto", productLabels[selected.product]],
                ["Ciclo comercial", selected.period],
                ["Usuários vinculados", String(selected.users)],
              ].map(([label, value]) => (
                <View key={label}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {label}
                  </Text>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: compactUiMetrics.bodyFontSize,
                      fontWeight: "700",
                      marginTop: 3,
                    }}
                  >
                    {value}
                  </Text>
                </View>
              ))}
              {editing ? (
                <View style={{ gap: 10 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    Produto
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {(["goatleta", "goatleta_pro"] as const).map(value => (
                      <Button key={value} onPress={() => setEditProduct(value)} selected={editProduct === value} label={productLabels[value]} />
                    ))}
                  </View>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    Situação
                  </Text>
                  <View
                    style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}
                  >
                    {(["evaluation", "active", "paused"] as const).map(value => (
                      <Button key={value} onPress={() => setEditStatus(value)} selected={editStatus === value} label={labels[value]} />
                    ))}
                  </View>
                  <Button icon="warningCircle" variant={editCommercialStatus === "attention" ? "danger" : "outline"} label={editCommercialStatus === "attention" ? "Em atenção comercial" : "Sem atenção comercial"} onPress={() => setEditCommercialStatus(value => value === "ok" ? "attention" : "ok")} />
                </View>
              ) : null}
              <View
                style={{
                  padding: compactUiMetrics.gap,
                  borderRadius: radius.internal,
                  backgroundColor: colors.secondaryBg,
                  gap: 5,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  Nota comercial
                </Text>
                {editing ? (
                  <TextInput
                    value={editNote}
                    onChangeText={setEditNote}
                    multiline
                    maxLength={1000}
                    placeholder="Adicione uma observação"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      minHeight: 76,
                      color: colors.inputText,
                      backgroundColor: colors.inputBg,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      textAlignVertical: "top",
                    }}
                  />
                ) : (
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                      lineHeight: 18,
                    }}
                  >
                    {selected.note || "Sem observação."}
                  </Text>
                )}
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <Text
                style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, fontWeight: "700" }}
              >
                Atividade recente
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <GoAtletaIcon
                  name="checkmarkCircle"
                  size={18}
                  color={colors.successText}
                />
                <View>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: compactUiMetrics.bodyFontSize,
                      fontWeight: "700",
                    }}
                  >
                    Cadastro revisado
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Hoje, 10:24
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: compactUiMetrics.gap }}>
                {editing ? <>
                  <Button label={busy ? "Salvando..." : "Salvar alterações"} variant="primary" disabled={busy} onPress={() => void saveInstitution()} />
                  <Button label="Cancelar" disabled={busy} onPress={() => setEditing(false)} />
                </> : <Button label="Gerenciar instituição" variant="primary" onPress={startEditing} />}
                {!editing && selected.id && selected.status !== "cancelled" && selected.status !== "paused" ? (
                  <Button label="Suspender instituição" accessibilityLabel={`Suspender ${selected.name}`} variant="danger" onPress={() => void suspendInstitution()} />
                ) : null}
                {selected.id ? <Button label="Ver acessos" onPress={() => router.push({ pathname: "/platform/accesses", params: { institution: selected.name } })} /> : null}
              </View>
            </View>
          </ResponsiveGrid>
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
