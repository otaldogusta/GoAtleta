import { useEffect, useRef, useState, type RefObject } from "react";
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { LessonVoiceInput } from "../../screens/session/components/LessonVoiceInput";

type Props = {
  value: string; onChangeText: (value: string) => void; onSend: () => void;
  busy?: boolean; inputRef?: RefObject<TextInput | null>;
  onFocus?: TextInputProps["onFocus"]; onBlur?: TextInputProps["onBlur"];
  onKeyPress?: TextInputProps["onKeyPress"];
  voiceScope: { organizationId: string; classId?: string } | undefined;
};
export function AssistantComposer(props: Props) {
  return <ScopedAssistantComposer key={`${props.voiceScope?.organizationId}:${props.voiceScope?.classId}`} {...props} />;
}
function ScopedAssistantComposer(props: Props) {
  const { colors } = useAppTheme();
  const localRef = useRef<TextInput | null>(null);
  const latestValue = useRef(props.value);
  useEffect(() => { latestValue.current = props.value; }, [props.value]);
  const inputRef = props.inputRef ?? localRef;
  const [inputHeight, setInputHeight] = useState(40);
  const [voiceActive, setVoiceActive] = useState(false);
  const maxHeight = Platform.OS === "web" ? 84 : 136;
  const canSend = Boolean(props.value.trim()) && !props.busy && !voiceActive;
  return <View style={[styles.row, { minHeight: props.value ? Math.max(44, inputHeight) : 44 }]}>
    {!voiceActive ? <Pressable accessibilityRole="button" accessibilityLabel="Escrever mensagem" onPress={() => inputRef.current?.focus()}
      style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.secondaryBg }]}>
      <GoAtletaIcon name="add" size={20} color={colors.text} />
    </Pressable> : null}
    <TextInput ref={inputRef} accessibilityLabel="Mensagem para o assistente" placeholder="Perguntar algo..."
      placeholderTextColor={colors.muted} value={props.value} maxLength={6000}
      onChangeText={value => { props.onChangeText(value); if (!value.trim()) setInputHeight(40); }}
      onFocus={props.onFocus} onBlur={props.onBlur} editable={!props.busy}
      onKeyPress={props.onKeyPress ?? (event => {
        const native = event.nativeEvent as { key?: string; shiftKey?: boolean };
        if (Platform.OS === "web" && native.key === "Enter" && !native.shiftKey) { event.preventDefault?.(); if (canSend) props.onSend(); }
      })}
      onContentSizeChange={event => setInputHeight(Math.max(40, Math.min(maxHeight, Math.ceil(event.nativeEvent.contentSize.height))))}
      multiline scrollEnabled={inputHeight >= maxHeight} returnKeyType="send"
      style={[styles.input, voiceActive && styles.hidden, { height: props.value ? inputHeight : 40, color: colors.inputText }]} />
    {props.voiceScope ? <LessonVoiceInput key={`${props.voiceScope.organizationId}:${props.voiceScope.classId}`} {...props.voiceScope} disabled={Boolean(props.busy)} onActiveChange={setVoiceActive}
      onText={text => props.onChangeText(latestValue.current ? `${latestValue.current}\n${text}` : text)} /> : null}
    {!voiceActive ? <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" onPress={props.onSend} disabled={!canSend}
      style={[styles.send, { backgroundColor: colors.primaryBg, opacity: canSend ? 1 : 0.55 }]}>
      <GoAtletaIcon name="arrowUp" size={20} color={colors.primaryText} />
    </Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  hidden: { display: "none" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  secondary: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 0, paddingHorizontal: 2, paddingVertical: 8, fontSize: 16, textAlignVertical: "top" },
});
