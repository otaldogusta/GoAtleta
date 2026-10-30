import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { getEventAttachmentUrl, type EventAttachment, type EventAttachmentFile } from "../../api/event-attachments";
import { getSessionIdentity, isSessionIdentityCurrent } from "../../auth/session";
import { getReadCacheGeneration } from "../../db/client";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { compactUiMetrics as metrics } from "../../theme/tokens";

type Props = {
  attachments: EventAttachment[];
  files: EventAttachmentFile[];
  removedIds: string[];
  canManage: boolean;
  disabled: boolean;
  loading: boolean;
  picking: boolean;
  error: string | null;
  progress: string | null;
  onPick: () => void;
  onOpen: (attachment: EventAttachment) => void;
  onRemovePending: (id: string) => void;
  onRemoveExisting: (id: string) => void;
  onRetry: () => void;
};

const sizeLabel = (bytes?: number) => !bytes ? "" : bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
const formatLabel = (name: string) => name.split(".").at(-1)?.slice(0, 5).toUpperCase() || "ARQ";

/** Private thumbnail state is scoped just like attachment reads, never cached across accounts. */
function usePreviewUri(file: EventAttachment | EventAttachmentFile, isImage: boolean) {
  const identity = getSessionIdentity(), generation = getReadCacheGeneration();
  const saved = "objectPath" in file ? file : null;
  const key = JSON.stringify([identity.userId, identity.generation, generation, file.id, saved?.organizationId, saved?.eventId, saved?.objectPath, saved?.uploadedAt]);
  const [preview, setPreview] = useState<{ key: string; uri: string } | null>(null);
  useEffect(() => {
    if (!saved || !saved.uploadedAt || !isImage || !identity.userId) return;
    let active = true;
    const session = getSessionIdentity(), cacheGeneration = getReadCacheGeneration();
    void getEventAttachmentUrl({ organizationId: saved.organizationId, eventId: saved.eventId, attachment: saved }).then(uri => {
      if (active && isSessionIdentityCurrent(session) && cacheGeneration === getReadCacheGeneration()) setPreview({ key, uri });
    }).catch(() => {}); // Download remains available if a thumbnail cannot load.
    return () => { active = false; };
  }, [saved, isImage, key, identity.userId]);
  if (!isImage) return null;
  if (!saved) return (file as EventAttachmentFile).uri;
  return preview?.key === key ? preview.uri : null;
}

function AttachmentPreview({ file }: { file: EventAttachment | EventAttachmentFile }) {
  const { colors } = useAppTheme();
  const isImage = Boolean(file.mimeType?.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name));
  const uri = usePreviewUri(file, isImage);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const format = formatLabel(file.name);
  return <View accessible={false} style={[styles.preview, { backgroundColor: colors.inputBg }]}>
    {uri && uri !== failedUri ? <Image testID={`attachment-preview-${file.id}`} accessible={false} source={{ uri }} resizeMode="cover" style={styles.previewImage} onError={() => setFailedUri(uri)} />
      : <><GoAtletaIcon name={isImage ? "gallery" : "document"} size={17} color={format === "PDF" ? colors.dangerText : colors.info} /><Text style={[styles.format, { color: format === "PDF" ? colors.dangerText : colors.info }]}>{format}</Text></>}
  </View>;
}

export function CalendarEventAttachments(props: Props) {
  const { colors } = useAppTheme();
  const existing = props.attachments.filter(file => !props.removedIds.includes(file.id)
    && !props.files.some(pending => pending.id === file.id) && (props.canManage || file.uploadedAt));
  const count = existing.length + props.files.length;
  if (!props.canManage && !count && !props.loading && !props.error) return null;
  return <View testID="calendar-attachments" style={[styles.field, { borderColor: colors.border }]}>
    <View style={styles.header}>
      <GoAtletaIcon name="attachment" size={metrics.iconSize} color={colors.muted} />
      <View style={styles.heading}><Text style={[styles.label, { color: colors.text }]}>Anexo</Text>
        {count ? <Text style={[styles.meta, { color: colors.muted }]}>{count} {count === 1 ? "item" : "itens"}</Text> : null}
      </View>
      {props.loading || props.picking ? <ActivityIndicator size="small" color={colors.muted} accessibilityLabel={props.picking ? "Selecionando anexo" : "Carregando anexos"} /> : null}
      {props.canManage ? <Pressable accessibilityRole="button" accessibilityLabel="Adicionar anexo" disabled={props.disabled || props.picking || props.loading}
        suppressWebHoverFeedback disableWebPressScale onPress={props.onPick} style={styles.add}><Text style={[styles.addText, { color: colors.info }]}>Adicionar</Text></Pressable> : null}
    </View>
    {existing.map(file => <View key={file.id} style={styles.fileRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={file.uploadedAt ? `Abrir anexo: ${file.name}` : `Envio pendente: ${file.name}`} disabled={props.disabled || !file.uploadedAt}
        suppressWebHoverFeedback disableWebPressScale onPress={() => props.onOpen(file)} style={styles.fileAction}>
        <AttachmentPreview file={file} />
        <View style={styles.fileText}><Text numberOfLines={2} style={[styles.fileName, { color: colors.text }]}>{file.name}</Text><Text style={[styles.meta, { color: colors.muted }]}>{[sizeLabel(file.sizeBytes), file.uploadedAt ? "" : "Envio pendente"].filter(Boolean).join(" · ")}</Text></View>
      </Pressable>
      {props.canManage ? <Pressable accessibilityRole="button" accessibilityLabel={`Remover anexo: ${file.name}`} disabled={props.disabled}
        suppressWebHoverFeedback disableWebPressScale onPress={() => props.onRemoveExisting(file.id)} style={styles.remove}><GoAtletaIcon name="remove" size={metrics.iconSize} color={colors.dangerText} /></Pressable> : null}
    </View>)}
    {props.files.map(file => <View key={file.id} style={styles.fileRow}>
      <View style={styles.fileAction}><AttachmentPreview file={file} />
        <View style={styles.fileText}><Text numberOfLines={2} style={[styles.fileName, { color: colors.text }]}>{file.name}</Text><Text style={[styles.meta, { color: colors.muted }]}>{[sizeLabel(file.size ?? file.file?.size), "Pendente"].filter(Boolean).join(" · ")}</Text></View>
      </View>
      {props.canManage ? <Pressable accessibilityRole="button" accessibilityLabel={`Remover anexo: ${file.name}`} disabled={props.disabled}
        suppressWebHoverFeedback disableWebPressScale onPress={() => props.onRemovePending(file.id)} style={styles.remove}><GoAtletaIcon name="remove" size={metrics.iconSize} color={colors.dangerText} /></Pressable> : null}
    </View>)}
    {props.progress ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.muted }]}>{props.progress}</Text> : null}
    {props.error ? <View style={styles.error}><Text accessibilityRole="alert" style={[styles.errorText, { color: colors.dangerText }]}>{props.error}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Tentar carregar anexos novamente" disabled={props.disabled || props.loading} onPress={props.onRetry} style={styles.retry}><GoAtletaIcon name="refresh" size={18} color={colors.info} /></Pressable>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  field: { borderBottomWidth: StyleSheet.hairlineWidth },
  header: { minHeight: metrics.touchTarget, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: metrics.gap },
  heading: { flex: 1, minWidth: 0, gap: 2 }, label: { fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight },
  add: { minHeight: metrics.touchTarget, minWidth: 72, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 4 }, addText: { fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "500" },
  fileRow: { flexDirection: "row", alignItems: "center", paddingLeft: 28, paddingBottom: 4 },
  fileAction: { minHeight: metrics.touchTarget, paddingVertical: 6, paddingHorizontal: 8, flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: metrics.gap, borderRadius: 12 },
  fileText: { flex: 1, minWidth: 0, gap: 2 }, fileName: { fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight }, meta: { fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight },
  preview: { width: metrics.controlHeight, height: metrics.controlHeight, borderRadius: 6, alignItems: "center", justifyContent: "center", gap: 2, overflow: "hidden" },
  previewImage: { width: metrics.controlHeight, height: metrics.controlHeight }, format: { fontSize: 9, fontWeight: "700" },
  remove: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  message: { paddingLeft: 28, paddingBottom: 8, fontSize: metrics.metadataFontSize },
  error: { paddingLeft: 36, flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 8 },
  errorText: { flex: 1, fontSize: metrics.bodyFontSize },
  retry: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
