import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  isPlatformAdmin,
  platformListAccessRequests,
  platformReviewAccessRequest,
  type OrganizationAccessRequest,
} from "../../api/organization-access-requests";
import { radius, spacing } from "../../theme/tokens";
import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useSaveToast } from "../../ui/save-toast";
import { useRouter } from "expo-router";

const demoRequests: OrganizationAccessRequest[] = [
  {
    id: "demo-alessandro",
    organizationId: "demo-rede",
    organizationName: "Rede Esportes Pinhais",
    requesterUserId: "demo-user",
    requesterEmail: "al********@gmail.com",
    requesterName: "Alessandro",
    status: "pending",
    requestedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewRoleLevel: null,
    requestedProduct: "goatleta",
    paymentStatus: "not_started",
  },
  {
    id: "demo-mariana",
    organizationId: "demo-campeoes",
    organizationName: "Instituto Campeões",
    requesterUserId: "demo-user-2",
    requesterEmail: "ma********@esporte.com",
    requesterName: "Mariana Costa",
    status: "pending",
    requestedAt: new Date(Date.now() - 5400000).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewRoleLevel: null,
    requestedProduct: "goatleta",
    paymentStatus: "not_started",
  },
  {
    id: "demo-ricardo",
    organizationId: "demo-sul",
    organizationName: "Centro Esportivo Sul",
    requesterUserId: "demo-user-12",
    requesterEmail: "ri********@gmail.com",
    requesterName: "Ricardo Alves",
    status: "pending",
    requestedAt: new Date(Date.now() - 86400000).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewRoleLevel: null,
    requestedProduct: "goatleta_pro",
    paymentStatus: "not_started",
  },
  {
    id: "demo-juliana",
    organizationId: "demo-rede",
    organizationName: "Rede Esportes Pinhais",
    requesterUserId: "demo-user-3",
    requesterEmail: "ju********@gmail.com",
    requesterName: "Juliana Souza",
    status: "approved",
    requestedAt: "2026-08-15T12:00:00.000Z",
    reviewedAt: "2026-08-15T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta",
    paymentStatus: "paid",
  },
  {
    id: "demo-carla",
    organizationId: "demo-clube",
    organizationName: "Clube Atlético Pinhais",
    requesterUserId: "demo-user-4",
    requesterEmail: "ca********@gmail.com",
    requesterName: "Carla Teixeira",
    status: "approved",
    requestedAt: "2026-08-08T12:00:00.000Z",
    reviewedAt: "2026-08-08T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta_pro",
    paymentStatus: "pending",
  },
  {
    id: "demo-pedro",
    organizationId: "demo-futuro",
    organizationName: "Associação Futuro",
    requesterUserId: "demo-user-5",
    requesterEmail: "pe********@clubes.com",
    requesterName: "Pedro Fonseca",
    status: "approved",
    requestedAt: "2026-08-12T12:00:00.000Z",
    reviewedAt: "2026-08-12T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta_pro",
    paymentStatus: "paid",
  },
  {
    id: "demo-lucas",
    organizationId: "demo-uniao",
    organizationName: "Projeto Social União",
    requesterUserId: "demo-user-6",
    requesterEmail: "lu********@gmail.com",
    requesterName: "Lucas Rocha",
    status: "approved",
    requestedAt: "2026-08-10T12:00:00.000Z",
    reviewedAt: "2026-08-10T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta",
    paymentStatus: "paid",
  },
  {
    id: "demo-felipe",
    organizationId: "demo-campeoes",
    organizationName: "Instituto Campeões",
    requesterUserId: "demo-user-7",
    requesterEmail: "fe********@gmail.com",
    requesterName: "Felipe Barbosa",
    status: "approved",
    requestedAt: "2026-08-05T12:00:00.000Z",
    reviewedAt: "2026-08-05T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta",
    paymentStatus: "pending",
  },
  {
    id: "demo-ana",
    organizationId: "demo-rede",
    organizationName: "Rede Esportes Pinhais",
    requesterUserId: "demo-user-8",
    requesterEmail: "an********@gmail.com",
    requesterName: "Ana Martins",
    status: "approved",
    requestedAt: "2026-08-01T12:00:00.000Z",
    reviewedAt: "2026-08-01T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta",
    paymentStatus: "paid",
  },
  {
    id: "demo-daniel",
    organizationId: "demo-clube",
    organizationName: "Clube Atlético Pinhais",
    requesterUserId: "demo-user-9",
    requesterEmail: "da********@gmail.com",
    requesterName: "Daniel Santos",
    status: "approved",
    requestedAt: "2026-07-28T12:00:00.000Z",
    reviewedAt: "2026-07-28T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta_pro",
    paymentStatus: "paid",
  },
  {
    id: "demo-bruno",
    organizationId: "demo-futuro",
    organizationName: "Associação Futuro",
    requesterUserId: "demo-user-10",
    requesterEmail: "br********@gmail.com",
    requesterName: "Bruno Ribeiro",
    status: "approved",
    requestedAt: "2026-07-25T12:00:00.000Z",
    reviewedAt: "2026-07-25T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta",
    paymentStatus: "paid",
  },
  {
    id: "demo-thiago",
    organizationId: "demo-sul",
    organizationName: "Centro Esportivo Sul",
    requesterUserId: "demo-user-11",
    requesterEmail: "th********@gmail.com",
    requesterName: "Thiago Henrique",
    status: "approved",
    requestedAt: "2026-07-22T12:00:00.000Z",
    reviewedAt: "2026-07-22T13:00:00.000Z",
    reviewedBy: "demo-admin",
    reviewRoleLevel: 10,
    requestedProduct: "goatleta",
    paymentStatus: "paid",
  },
];

const statusLabel = {
  pending: "Pendente",
  approved: "Ativo",
  rejected: "Recusado",
} as const;
const productLabel = {
  goatleta: "GoAtleta",
  goatleta_pro: "GoAtleta Pro",
} as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
const relativeDate = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString())
    return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleDateString("pt-BR");
};
const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-0000-4000-8000-000000000000`;

function StatusPill({ request }: { request: OrganizationAccessRequest }) {
  const { colors } = useAppTheme();
  const tone =
    request.status === "pending"
      ? "warning"
      : request.status === "approved"
        ? "success"
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
        numberOfLines={1}
        style={
          {
            color: colors[`${tone}Text`],
            fontSize: 12,
            fontWeight: "800",
            whiteSpace: "nowrap",
          } as any
        }
      >
        {statusLabel[request.status]}
      </Text>
    </View>
  );
}

export function PlatformAccessDashboard({
  designPreview = false,
  initialInstitution = "",
}: {
  designPreview?: boolean;
  initialInstitution?: string;
}) {
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1200;
  const [requests, setRequests] = useState<OrganizationAccessRequest[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState(initialInstitution);
  const [status, setStatus] = useState<
    "all" | OrganizationAccessRequest["status"]
  >("all");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (designPreview) {
      setAuthorized(true);
      setDemo(true);
      setRequests(demoRequests);
      setSelectedId("demo-alessandro");
      setLoading(false);
      return;
    }
    try {
      const allowed = await isPlatformAdmin();
      setAuthorized(allowed);
      if (!allowed) {
        setRequests([]);
        return;
      }
      const loaded = await platformListAccessRequests();
      setRequests(loaded);
      setSelectedId((current) => current || loaded[0]?.id || "");
    } catch {
      if (__DEV__) {
        setAuthorized(true);
        setDemo(true);
        setRequests(demoRequests);
        setSelectedId("demo-alessandro");
      } else setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }, [designPreview]);

  useEffect(() => {
    // Reconcile this dashboard with platform access records on mount/preview changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      requests.filter((request) => {
        const matchesStatus = status === "all" || request.status === status;
        const term = query.trim().toLowerCase();
        return (
          matchesStatus &&
          (!term ||
            `${request.requesterName} ${request.requesterEmail} ${request.organizationName}`
              .toLowerCase()
              .includes(term))
        );
      }),
    [query, requests, status],
  );
  const selected =
    requests.find((request) => request.id === selectedId) ??
    filtered[0] ??
    null;
  const pending = demo
    ? 3
    : requests.filter((request) => request.status === "pending").length;
  const active = demo
    ? 18
    : requests.filter((request) => request.status === "approved").length;
  const rejected = demo
    ? 1
    : requests.filter((request) => request.status === "rejected").length;

  const review = async (decision: "approved" | "rejected") => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      if (!demo)
        await platformReviewAccessRequest({
          requestId: selected.id,
          decision,
          idempotencyKey: createIdempotencyKey(),
        });
      setRequests((current) =>
        current.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                status: decision,
                reviewedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      showSaveToast({
        variant: "success",
        message:
          decision === "approved"
            ? `Acesso de ${selected.requesterName.split(" ")[0]} aprovado.`
            : "Solicitação recusada.",
      });
    } catch (error) {
      showSaveToast({
        variant: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível revisar o acesso.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (authorized === false)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <GoAtletaIcon name="lock" size={30} color={colors.muted} />
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: "800",
            marginTop: 12,
          }}
        >
          Acesso restrito
        </Text>
        <Text style={{ color: colors.muted, marginTop: 6 }}>
          Esta área é exclusiva da administração da plataforma.
        </Text>
      </View>
    );

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenPageHeader
        title="Acessos"
        subtitle="Usuários, instituições e produtos"
        onBack={() => router.replace("/coord/dashboard")}
        horizontalBleed={0}
        fadeHeight={10}
        contentStyle={{
          paddingTop: Platform.OS === "web" ? 12 : 8,
          paddingBottom: 0,
        }}
        right={
          wide ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
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
                  placeholder="Buscar usuários, instituições..."
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
                    message: "Use os filtros da lista para refinar os acessos.",
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
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                >
                  Filtros
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Configurações de acesso"
                onPress={() =>
                  showSaveToast({
                    variant: "info",
                    message:
                      "As regras de acesso são gerenciadas pela plataforma.",
                  })
                }
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GoAtletaIcon name="management" size={18} color={colors.text} />
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
            {[
              [
                "time",
                String(pending),
                "aguardando aprovação",
                colors.warningText,
              ],
              ["members", String(active), "ativos", colors.successText],
              ["close", String(rejected), "recusados", colors.dangerText],
            ].map(([icon, value, label, color]) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  minHeight: 78,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <GoAtletaIcon
                  name={icon as GoAtletaIconName}
                  size={23}
                  color={color}
                />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  {value}
                </Text>
                <Text style={{ color, fontSize: 13, fontWeight: "700" }}>
                  {label}
                </Text>
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
                flex: 1,
                width: "100%",
                minWidth: 0,
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                overflow: "hidden",
              }}
            >
              <View style={{ padding: 16, gap: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: "900",
                    }}
                  >
                    Solicitações de acesso
                  </Text>
                  <Button
                    label="Conceder acesso"
                    onPress={() =>
                      showSaveToast({
                        variant: "info",
                        message:
                          "Escolha uma pessoa cadastrada para conceder acesso.",
                      })
                    }
                  />
                </View>
                <View
                  style={{
                    flexDirection: width >= 760 ? "row" : "column",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      minHeight: 46,
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
                      size={17}
                      color={colors.muted}
                    />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Buscar usuário, instituição..."
                      placeholderTextColor={colors.placeholder}
                      style={{
                        flex: 1,
                        minHeight: 46,
                        color: colors.inputText,
                        borderRadius: 0,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {(["all", "pending", "approved"] as const).map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setStatus(value)}
                        style={{
                          minHeight: 42,
                          paddingHorizontal: 12,
                          borderRadius: radius.internal,
                          borderWidth: 1,
                          borderColor:
                            status === value ? colors.primaryBg : colors.border,
                          backgroundColor:
                            status === value
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
                          {value === "all" ? "Todos" : statusLabel[value]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              {width >= 760 ? (
                <View
                  style={{
                    minHeight: 40,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: colors.muted,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    USUÁRIO
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: colors.muted,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    INSTITUIÇÃO
                  </Text>
                  <Text
                    style={{
                      width: 96,
                      color: colors.muted,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    PRODUTO
                  </Text>
                  <Text
                    style={{
                      width: 148,
                      color: colors.muted,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    STATUS
                  </Text>
                  {width >= 900 ? (
                    <Text
                      style={{
                        width: 92,
                        color: colors.muted,
                        fontSize: 11,
                        fontWeight: "800",
                      }}
                    >
                      SOLICITADO EM
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {loading ? (
                <Text style={{ color: colors.muted, padding: 20 }}>
                  Carregando acessos...
                </Text>
              ) : (
                filtered.slice(0, 12).map((request) => (
                  <Pressable
                    key={request.id}
                    onPress={() => setSelectedId(request.id)}
                    style={{
                      minHeight: 58,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor:
                        selected?.id === request.id
                          ? colors.successBg
                          : "transparent",
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor:
                          request.status === "approved"
                            ? colors.successBg
                            : colors.infoBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 11,
                          fontWeight: "900",
                        }}
                      >
                        {initials(request.requesterName)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 13,
                          fontWeight: "800",
                        }}
                      >
                        {request.requesterName}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.muted, fontSize: 11 }}
                      >
                        {request.requesterEmail}
                      </Text>
                    </View>
                    {width >= 760 ? (
                      <>
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, color: colors.text, fontSize: 12 }}
                        >
                          {request.organizationName}
                        </Text>
                        <Text
                          style={{
                            width: 96,
                            color: colors.text,
                            fontSize: 12,
                          }}
                        >
                          {productLabel[request.requestedProduct]}
                        </Text>
                      </>
                    ) : null}
                    <View style={{ width: width >= 760 ? 148 : undefined }}>
                      <StatusPill request={request} />
                    </View>
                    {width >= 900 ? (
                      <Text
                        style={{ width: 92, color: colors.muted, fontSize: 11 }}
                      >
                        {relativeDate(request.requestedAt)}
                      </Text>
                    ) : null}
                  </Pressable>
                ))
              )}
              {!loading && filtered.length ? (
                <View
                  style={{
                    minHeight: 48,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Mostrando 1 a {Math.min(12, filtered.length)} de{" "}
                    {demo ? 23 : filtered.length} acessos
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Pressable
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <GoAtletaIcon
                        name="chevronBack"
                        size={15}
                        color={colors.muted}
                      />
                    </Pressable>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.primaryBg,
                        backgroundColor: colors.successBg,
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
                        1
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      2
                    </Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      3
                    </Text>
                    <Pressable
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <GoAtletaIcon
                        name="chevronForward"
                        size={15}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
            {selected ? (
              <View
                style={{
                  width: wide ? 400 : "100%",
                  borderRadius: radius.container,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 18,
                  gap: 16,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
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
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {initials(selected.requesterName)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 18,
                        fontWeight: "900",
                      }}
                    >
                      {selected.requesterName}
                    </Text>
                    <StatusPill request={selected} />
                  </View>
                  <GoAtletaIcon name="close" size={18} color={colors.muted} />
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: "900",
                  }}
                >
                  Informações da conta
                </Text>
                {[
                  ["E-mail", selected.requesterEmail],
                  ["Telefone", "(41) 9 9911-****"],
                  ["Instituição", selected.organizationName ?? "—"],
                  [
                    "Produto solicitado",
                    productLabel[selected.requestedProduct],
                  ],
                  [
                    "Plano e status",
                    selected.status === "pending"
                      ? "Em avaliação"
                      : statusLabel[selected.status],
                  ],
                ].map(([label, value]) => (
                  <View key={label} style={{ gap: 3 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {label}
                    </Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: "900",
                  }}
                >
                  Histórico de acesso
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <GoAtletaIcon
                    name="checkmarkCircle"
                    size={18}
                    color={colors.primaryBg}
                  />
                  <View>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      Solicitação enviada
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {relativeDate(selected.requestedAt)}
                    </Text>
                  </View>
                </View>
                {selected.status === "pending" ? (
                  <View style={{ marginTop: 4, gap: 8 }}>
                    <Button
                      label={busy ? "Aprovando..." : "Aprovar acesso"}
                      disabled={busy}
                      onPress={() => void review("approved")}
                    />
                    <Pressable
                      disabled={busy}
                      onPress={() => void review("rejected")}
                      style={{
                        minHeight: 44,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: radius.internal,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{ color: colors.dangerText, fontWeight: "800" }}
                      >
                        Recusar
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ResponsiveGrid>
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
