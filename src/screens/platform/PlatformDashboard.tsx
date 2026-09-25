import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { radius, spacing } from "../../theme/tokens";
import { APP_PRODUCT_LABELS } from "../../config/brand";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useSaveToast } from "../../ui/save-toast";
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
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text
        style={{
          color: colors[`${tone}Text`],
          fontSize: 12,
          fontWeight: "800",
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
                  minHeight: 44,
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 12,
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
                  style={{
                    flex: 1,
                    minHeight: 44,
                    color: colors.inputText,
                    borderRadius: 0,
                  }}
                />
                <GoAtletaIcon name="search" size={17} color={colors.muted} />
              </View>
              <Pressable
                onPress={() =>
                  showSaveToast({
                    variant: "info",
                    message: "Use as abas para filtrar as instituições.",
                  })
                }
                style={{
                  minHeight: 44,
                  paddingHorizontal: 15,
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <GoAtletaIcon name="options" size={17} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  Filtros
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
      >
        <ResponsivePage variant="dashboard" gap={spacing.md}>
          <View
            style={{ flexDirection: width >= 760 ? "row" : "column", gap: 12 }}
          >
            {metrics.map(([icon, value, label, color]) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  minHeight: 84,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 13,
                }}
              >
                <GoAtletaIcon name={icon} size={22} color={color} />
                <View>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 22,
                      fontWeight: "900",
                    }}
                  >
                    {value}
                  </Text>
                  <Text style={{ color, fontSize: 12, fontWeight: "700" }}>
                    {label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <ResponsiveGrid
            columns={{ compact: "1", split: "8/4" }}
            gap={14}
            style={{ alignItems: "flex-start" }}
          >
            <View
              style={{
                minWidth: 0,
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                overflow: "hidden",
              }}
            >
              <View style={{ padding: 16, gap: 12 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: "900",
                  }}
                >
                  Instituições
                </Text>
                <View
                  style={{
                    flexDirection: width >= 760 ? "row" : "column",
                    gap: 10,
                  }}
                >
                  <View
                    style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}
                  >
                    {(
                      [
                        "all",
                        "evaluation",
                        "active",
                        "paused",
                        "cancelled",
                      ] as const
                    ).map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setFilter(value)}
                        style={{
                          minHeight: 40,
                          paddingHorizontal: 12,
                          borderRadius: radius.internal,
                          borderWidth: 1,
                          borderColor:
                            filter === value ? colors.primaryBg : colors.border,
                          backgroundColor:
                            filter === value
                              ? colors.successBg
                              : colors.secondaryBg,
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          {value === "all" ? "Todas" : labels[value]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View
                    style={{
                      flex: 1,
                      minHeight: 42,
                      borderRadius: radius.internal,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                      paddingHorizontal: 12,
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
                      style={{
                        flex: 1,
                        minHeight: 42,
                        color: colors.inputText,
                        borderRadius: 0,
                      }}
                    />
                  </View>
                </View>
              </View>
              {width >= 760 ? (
                <View
                  style={{
                    minHeight: 38,
                    paddingHorizontal: 16,
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
                      width: 48,
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
                    minHeight: 72,
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
                    minHeight: 72,
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
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedId(item.id)}
                    style={{
                      minHeight: 64,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor:
                        selected.id === item.id
                          ? colors.successBg
                          : "transparent",
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
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
                      style={{ flex: width >= 760 ? 1.25 : 1, minWidth: 0 }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.text,
                          fontSize: 13,
                          fontWeight: "800",
                        }}
                      >
                        {item.name}
                      </Text>
                      {width < 760 ? (
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          {item.responsible} · {productLabels[item.product]}
                        </Text>
                      ) : null}
                    </View>
                    {width >= 760 ? (
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
                    <View style={{ width: width >= 760 ? 100 : undefined }}>
                      <StatusPill status={item.status} />
                    </View>
                    {width >= 760 ? (
                      <Text
                        style={{
                          width: 48,
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
                width: wide ? 390 : "100%",
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 18,
                gap: 15,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.infoBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GoAtletaIcon
                    name="organization"
                    size={22}
                    color={colors.infoText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: "900",
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
                      fontSize: 14,
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
                    {(["goatleta", "goatleta_pro"] as const).map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setEditProduct(value)}
                        style={{
                          flex: 1,
                          minHeight: 38,
                          borderRadius: radius.internal,
                          borderWidth: 1,
                          borderColor:
                            editProduct === value
                              ? colors.primaryBg
                              : colors.border,
                          backgroundColor:
                            editProduct === value
                              ? colors.successBg
                              : colors.secondaryBg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          {productLabels[value]}
                        </Text>
                      </Pressable>
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
                    {(["evaluation", "active", "paused"] as const).map(
                      (value) => (
                        <Pressable
                          key={value}
                          onPress={() => setEditStatus(value)}
                          style={{
                            minHeight: 36,
                            paddingHorizontal: 10,
                            borderRadius: radius.internal,
                            borderWidth: 1,
                            borderColor:
                              editStatus === value
                                ? colors.primaryBg
                                : colors.border,
                            backgroundColor:
                              editStatus === value
                                ? colors.successBg
                                : colors.secondaryBg,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: colors.text,
                              fontSize: 11,
                              fontWeight: "800",
                            }}
                          >
                            {labels[value]}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  <Pressable
                    onPress={() =>
                      setEditCommercialStatus((value) =>
                        value === "ok" ? "attention" : "ok",
                      )
                    }
                    style={{
                      minHeight: 40,
                      borderRadius: radius.internal,
                      borderWidth: 1,
                      borderColor:
                        editCommercialStatus === "attention"
                          ? colors.dangerBorder
                          : colors.border,
                      backgroundColor:
                        editCommercialStatus === "attention"
                          ? colors.dangerBg
                          : colors.secondaryBg,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <GoAtletaIcon
                      name="warningCircle"
                      size={16}
                      color={
                        editCommercialStatus === "attention"
                          ? colors.dangerText
                          : colors.muted
                      }
                    />
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {editCommercialStatus === "attention"
                        ? "Em atenção comercial"
                        : "Sem atenção comercial"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <View
                style={{
                  padding: 13,
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
                style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}
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
                      fontSize: 13,
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
              {editing ? (
                <View style={{ gap: 8 }}>
                  <Button
                    label={busy ? "Salvando..." : "Salvar alterações"}
                    disabled={busy}
                    onPress={() => void saveInstitution()}
                  />
                  <Pressable
                    disabled={busy}
                    onPress={() => setEditing(false)}
                    style={{
                      minHeight: 42,
                      borderRadius: radius.internal,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      Cancelar
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Button label="Gerenciar instituição" onPress={startEditing} />
              )}
              {!editing &&
              selected.id &&
              selected.status !== "cancelled" &&
              selected.status !== "paused" ? (
                <Pressable
                  onPress={() => void suspendInstitution()}
                  accessibilityRole="button"
                  accessibilityLabel={`Suspender ${selected.name}`}
                  style={{
                    minHeight: 44,
                    borderRadius: radius.internal,
                    borderWidth: 1,
                    borderColor: colors.dangerBorder,
                    backgroundColor: colors.dangerBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.dangerText, fontWeight: "800" }}>
                    Suspender instituição
                  </Text>
                </Pressable>
              ) : null}
              {selected.id ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/platform/accesses",
                      params: { institution: selected.name },
                    })
                  }
                  style={{
                    minHeight: 44,
                    borderRadius: radius.internal,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    Ver acessos
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ResponsiveGrid>
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
