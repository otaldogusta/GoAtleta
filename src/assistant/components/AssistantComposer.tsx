import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { LessonVoiceInput } from "../../screens/session/components/LessonVoiceInput";
import { useContainerResponsiveLayout } from "../../ui/use-container-responsive-layout";
import { radius, typography } from "../../theme/tokens";

type Props = {
  value: string; onChangeText: (value: string) => void; onSend: () => void;
  busy?: boolean; inputRef?: RefObject<TextInput | null>;
  onFocus?: TextInputProps["onFocus"]; onBlur?: TextInputProps["onBlur"];
  onKeyPress?: TextInputProps["onKeyPress"];
  voiceScope: { organizationId: string; classId?: string } | undefined;
  trailingControl?: ReactNode;
  compact?: boolean;
  variant?: "inline" | "page";
};
export function AssistantComposer(props: Props) {
  return <ScopedAssistantComposer key={`${props.voiceScope?.organizationId}:${props.voiceScope?.classId}`} {...props} />;
}
function ScopedAssistantComposer(props: Props) {
  const { colors } = useAppTheme();
  const { containerRef, onLayout, width } = useContainerResponsiveLayout();
  const localRef = useRef<TextInput | null>(null);
  const latestValue = useRef(props.value);
  useEffect(() => { latestValue.current = props.value; }, [props.value]);
  const inputRef = props.inputRef ?? localRef;
  const page = props.variant === "page";
  const minInputHeight = page ? 44 : 40;
  const [inputHeight, setInputHeight] = useState(minInputHeight);
  const [voiceActive, setVoiceActive] = useState(false);
  const maxHeight = page ? 136 : Platform.OS === "web" ? 84 : 136;
  const canSend = Boolean(props.value.trim()) && !props.busy && !voiceActive;
  const compact = props.compact === true && !page;
  const stacked = page || (Boolean(props.trailingControl) && width < 520);
  return <View ref={containerRef} onLayout={onLayout} testID="assistant-composer" style={[styles.row, compact && { gap: 4, alignItems: "center" }, stacked && styles.stacked, page && [styles.page, { backgroundColor: colors.inputBg, borderColor: colors.border }], { minHeight: compact ? 36 : props.value ? Math.max(44, inputHeight) : 44 }]}>
    <View style={[styles.editor, stacked && styles.stackedEditor, voiceActive && styles.hidden]}>
    {!voiceActive && !page ? <Pressable accessibilityRole="button" accessibilityLabel="Escrever mensagem" onPress={() => inputRef.current?.focus()}
      style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.secondaryBg }]}>
      <GoAtletaIcon name="add" size={compact ? 16 : 20} color={colors.text} />
    </Pressable> : null}
    <TextInput ref={inputRef} accessibilityLabel="Mensagem para o assistente" placeholder="Perguntar algo..."
      placeholderTextColor={colors.muted} value={props.value} maxLength={6000}
      onChangeText={value => { props.onChangeText(value); if (!value.trim()) setInputHeight(minInputHeight); }}
      onFocus={props.onFocus} onBlur={props.onBlur} editable={!props.busy}
      onKeyPress={props.onKeyPress ?? (event => {
        const native = event.nativeEvent as { key?: string; shiftKey?: boolean };
        if (Platform.OS === "web" && native.key === "Enter" && !native.shiftKey) { event.preventDefault?.(); if (canSend) props.onSend(); }
      })}
      onContentSizeChange={event => setInputHeight(Math.max(minInputHeight, Math.min(maxHeight, Math.ceil(event.nativeEvent.contentSize.height))))}
      multiline scrollEnabled={inputHeight >= maxHeight} returnKeyType="send"
      style={[styles.input, compact && { minHeight: 36, fontSize: 13, paddingVertical: 8 }, stacked && { minHeight: 44, fontSize: 16 }, page && styles.pageInput, voiceActive && styles.hidden, { height: props.value ? inputHeight : compact ? 36 : minInputHeight, color: colors.inputText }]} />
    </View>
    <View style={[styles.controls, stacked && styles.stackedControls, page && styles.pageControls, voiceActive && styles.activeControls]}>
    {!voiceActive && props.trailingControl ? <View style={stacked && !page && styles.leadingControl}>{props.trailingControl}</View> : null}
    {props.voiceScope ? <LessonVoiceInput compact={compact} toolbar={page} key={`${props.voiceScope.organizationId}:${props.voiceScope.classId}`} {...props.voiceScope} disabled={Boolean(props.busy)} onActiveChange={setVoiceActive}
      onText={text => props.onChangeText(latestValue.current ? `${latestValue.current}\n${text}` : text)} /> : null}
    {!voiceActive ? <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" onPress={props.onSend} disabled={!canSend}
      style={[styles.send, compact && { width: 36, height: 36, borderRadius: 18 }, { backgroundColor: page ? "transparent" : colors.primaryBg, opacity: canSend ? 1 : 0.55 }]}>
      {page ? (
        <View style={[styles.pageSendGlyph, { backgroundColor: colors.text }]}>
          <GoAtletaIcon name="arrowUp" size={17} color={colors.background} />
        </View>
      ) : <GoAtletaIcon name="arrowUp" size={compact ? 16 : 20} color={colors.primaryText} />}
    </Pressable> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  hidden: { display: "none" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  stacked: { flexDirection: "column", alignItems: "stretch", gap: 4 },
  page: { borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, gap: 0 },
  pageInput: { minHeight: 44, fontSize: 14, lineHeight: 20, paddingHorizontal: 4, paddingVertical: 8, ...(Platform.OS === "web" ? { fontFamily: typography.body.fontFamily } : {}) },
  pageControls: { justifyContent: "flex-end", minHeight: 44, gap: 0 },
  pageSendGlyph: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  editor: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  stackedEditor: { width: "100%", flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  controls: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  stackedControls: { width: "100%" },
  activeControls: { flex: 1, minWidth: 0 },
  leadingControl: { flex: 1, minWidth: 0 },
  secondary: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 0, paddingHorizontal: 2, paddingVertical: 8, fontSize: 16, textAlignVertical: "top" },
});
