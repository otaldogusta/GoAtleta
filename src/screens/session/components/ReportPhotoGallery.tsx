import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { radius, spacing } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";

type Source = "camera" | "library";
export function ReportPhotoGallery({ colors, compact, uris, limit, busy, selectedIndex, onOpen, onClose, onAdd, onReplace, onRemove }: {
  colors: ThemeColors; compact: boolean; uris: string[]; limit: number; busy: boolean;
  selectedIndex: number | null; onOpen: (index: number) => void; onClose: () => void;
  onAdd: (source: Source) => void; onReplace: (source: Source, index: number) => void; onRemove: (index: number) => void;
}) {
  const [sourceRequest, setSourceRequest] = useState<{ index?: number } | null>(null);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const selectedUri = selectedIndex === null ? undefined : uris[selectedIndex];
  const compactGallery = compact || (galleryWidth > 0 && galleryWidth < 400);
  const columns = compactGallery ? 2 : 3;
  const width = galleryWidth > 0 ? (galleryWidth - spacing.sm * (columns - 1)) / columns : compactGallery ? "46%" : "30%";
  const closeSource = () => setSourceRequest(null);
  const pick = (source: Source) => {
    if (busy || !sourceRequest) return;
    const index = sourceRequest.index;
    closeSource();
    if (index === undefined) onAdd(source); else onReplace(source, index);
  };
  const closeButton = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.close, { borderColor: colors.border }]}><GoAtletaIcon name="close" size={18} color={colors.text} /></Pressable>;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.heading}>
        <GoAtletaIcon name="gallery" size={16} color={colors.muted} /><Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: colors.text }}>Fotos da aula</Text>
        <Text accessibilityLabel={`${uris.length} de ${limit} fotos`} accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 12 }}>{uris.length} de {limit}</Text>
      </View>
      <View onLayout={event => setGalleryWidth(event.nativeEvent.layout.width)} style={styles.gallery}>
        {uris.map((uri, index) => <View key={`${index}:${uri}`} style={{ width, aspectRatio: 1.5, position: "relative" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Ampliar foto ${index + 1}`} onPress={() => onOpen(index)} style={[styles.preview, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Image source={{ uri }} resizeMode="cover" accessibilityLabel={`Foto ${index + 1} da aula`} style={{ width: "100%", height: "100%" }} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remover foto ${index + 1}`} disabled={busy} onPress={() => onRemove(index)} style={[styles.remove, { backgroundColor: colors.background, borderColor: colors.border, opacity: busy ? 0.55 : 0.92 }]}><GoAtletaIcon name="close" size={14} color={colors.text} /></Pressable>
        </View>)}
        {uris.length < limit ? <Pressable accessibilityRole="button" accessibilityLabel="Adicionar foto" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => setSourceRequest({})}
          style={[styles.add, { width: compactGallery || !uris.length ? "100%" : width, aspectRatio: compactGallery || !uris.length ? undefined : 1.5, flexDirection: compactGallery || !uris.length ? "row" : "column", borderColor: colors.border, opacity: busy ? 0.55 : 1 }]}>
          <GoAtletaIcon name={busy ? "ellipsisHorizontal" : "add"} size={20} color={colors.muted} /><Text style={{ fontSize: 12, color: colors.muted }}>{busy ? "Abrindo…" : "Adicionar foto"}</Text>
        </Pressable> : null}
      </View>

      <ModalSheet visible={Boolean(selectedUri)} onClose={onClose} position="center" overlayZIndex={30000} backdropOpacity={0.7} cardStyle={[styles.viewer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.dialogHeading}><Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" }}>Foto {(selectedIndex ?? 0) + 1} de {uris.length}</Text>{closeButton("Fechar foto", onClose)}</View>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {selectedUri ? <Image source={{ uri: selectedUri }} resizeMode="contain" accessibilityLabel="Foto ampliada da aula" style={{ width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.background }} /> : null}
        </ScrollView>
        <View style={{ alignSelf: "flex-end", padding: spacing.xs }}><Button label="Trocar foto" variant="ghost" disabled={busy} onPress={() => { if (selectedIndex !== null) { setSourceRequest({ index: selectedIndex }); onClose(); } }} /></View>
      </ModalSheet>
      <ModalSheet visible={sourceRequest !== null} onClose={closeSource} position="center" overlayZIndex={31000} cardStyle={[styles.source, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.heading}><Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: "700" }}>{sourceRequest?.index === undefined ? "Adicionar foto" : "Trocar foto"}</Text>{closeButton("Fechar opções de foto", closeSource)}</View>
        {(["camera", "library"] as const).map(source => <Pressable key={source} accessibilityRole="button" accessibilityLabel={source === "camera" ? "Tirar foto" : "Escolher da galeria"} disabled={busy} onPress={() => pick(source)} style={[styles.sourceAction, { borderColor: colors.border, opacity: busy ? 0.55 : 1 }]}><GoAtletaIcon name={source === "camera" ? "camera" : "gallery"} size={20} color={colors.text} /><Text style={{ color: colors.text, fontSize: 14 }}>{source === "camera" ? "Tirar foto" : "Escolher da galeria"}</Text></Pressable>)}
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  preview: { width: "100%", height: "100%", borderWidth: 1, borderRadius: radius.internal, overflow: "hidden" },
  remove: { position: "absolute", right: 6, top: 6, width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  add: { minHeight: 50, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.internal, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  close: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  viewer: { width: "100%", maxWidth: 680, maxHeight: "90%", borderWidth: 1, borderRadius: radius.container, padding: 0, overflow: "hidden" },
  dialogHeading: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  source: { width: "100%", maxWidth: 360, borderWidth: 1, borderRadius: radius.container, padding: spacing.md, gap: spacing.sm },
  sourceAction: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderRadius: radius.internal },
});
