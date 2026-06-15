import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { ModalDialogFrame } from "../../ui/ModalDialogFrame";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import {
  addCatalogActivityToLesson,
  loadCatalogLessonDestinations,
  type CatalogLessonDestination,
} from "./activity-catalog-plan-actions";
import type { ActivityCatalogListItem } from "./activity-catalog-view-model";

type Props = {
  item: ActivityCatalogListItem | null;
  onCancel: () => void;
  onAdded: (message: string) => void;
  onOpenPlanning: () => void;
};

export function ActivityCatalogAddToLessonModal({
  item,
  onCancel,
  onAdded,
  onOpenPlanning,
}: Props) {
  const { colors } = useAppTheme();
  const [destinations, setDestinations] = useState<CatalogLessonDestination[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!item) return undefined;
    setLoading(true);
    setError("");
    setDestinations([]);
    setSelectedId("");
    loadCatalogLessonDestinations()
      .then((nextDestinations) => {
        if (cancelled) return;
        setDestinations(nextDestinations);
        setSelectedId(nextDestinations[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar as aulas disponíveis.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (!item) return null;

  const selectedDestination =
    destinations.find((destination) => destination.id === selectedId) ?? null;
  const canAdd = Boolean(selectedDestination) && !saving;

  const handleAdd = async () => {
    if (!selectedDestination || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await addCatalogActivityToLesson(selectedDestination, item);
      onAdded(
        result.added
          ? `Atividade adicionada: ${selectedDestination.label}.`
          : `Esta atividade já está na aula: ${selectedDestination.label}.`
      );
    } catch {
      setError("Não foi possível adicionar este exercício à aula.");
    } finally {
      setSaving(false);
    }
  };

  const hasDestinations = destinations.length > 0;

  return (
    <ModalDialogFrame
      visible
      onClose={onCancel}
      colors={colors}
      title={hasDestinations || loading ? "Adicionar à aula" : "Nenhuma aula disponível"}
      subtitle={item.variant.name}
      cardStyle={{ width: "100%", maxWidth: 560, maxHeight: "86%" }}
      contentContainerStyle={{ gap: 14, paddingTop: 14, paddingBottom: 16 }}
      footer={
        hasDestinations ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              testID="activity-catalog-cancel-add"
              onPress={onCancel}
              disabled={saving}
              style={{
                flex: 1,
                minHeight: 42,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.secondaryText, fontWeight: "900" }}>
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              testID="activity-catalog-confirm-add"
              onPress={handleAdd}
              disabled={!canAdd}
              style={{
                flex: 1,
                minHeight: 42,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: canAdd ? colors.primaryBg : colors.primaryDisabledBg,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
                {saving ? "Adicionando..." : "Adicionar"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              testID="activity-catalog-cancel-add"
              onPress={onCancel}
              style={{
                flex: 1,
                minHeight: 42,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.secondaryText, fontWeight: "900" }}>
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              testID="activity-catalog-open-planning"
              onPress={onOpenPlanning}
              style={{
                flex: 1,
                minHeight: 42,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primaryBg,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
                Ir para planejamento
              </Text>
            </Pressable>
          </View>
        )
      }
    >
      {loading ? (
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          Carregando aulas disponíveis...
        </Text>
      ) : hasDestinations ? (
        <>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
            Para qual aula você quer adicionar “{item.variant.name}”?
          </Text>
          <View style={{ gap: 8 }}>
            {destinations.map((destination) => {
              const selected = destination.id === selectedId;
              return (
                <Pressable
                  key={destination.id}
                  testID={`activity-catalog-destination-${destination.id}`}
                  onPress={() => setSelectedId(destination.id)}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: selected ? colors.successBorder : colors.border,
                    backgroundColor: selected ? colors.successBg : colors.card,
                    gap: 3,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.successText : colors.text,
                      fontSize: 14,
                      fontWeight: "900",
                    }}
                  >
                    {destination.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                    {destination.detail}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              testID="activity-catalog-choose-other-plan"
              onPress={onOpenPlanning}
              style={{
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.secondaryText, fontSize: 14, fontWeight: "900" }}>
                Escolher outro plano
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
          Crie ou abra uma aula planejada para adicionar este exercício.
        </Text>
      )}

      {error ? (
        <View
          testID="activity-catalog-add-error"
          style={{
            padding: 10,
            borderRadius: 12,
            backgroundColor: colors.dangerBg,
            borderWidth: 1,
            borderColor: colors.dangerBorder,
          }}
        >
          <Text style={{ color: colors.dangerText, fontSize: 13, fontWeight: "800" }}>
            {error}
          </Text>
        </View>
      ) : null}
    </ModalDialogFrame>
  );
}
