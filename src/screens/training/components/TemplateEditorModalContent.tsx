import { memo } from "react";

import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FadeHorizontalScroll } from "../../../ui/FadeHorizontalScroll";
import { useAppTheme } from "../../../ui/app-theme";
import { TimeInput } from "../../../ui/TimeInput";

type Props = {
  templateTitle: string;
  setTemplateTitle: (value: string) => void;
  templateAge: string;
  setTemplateAge: (value: string) => void;
  templateTags: string;
  setTemplateTags: (value: string) => void;
  templateWarmup: string;
  setTemplateWarmup: (value: string) => void;
  templateMain: string;
  setTemplateMain: (value: string) => void;
  templateCooldown: string;
  setTemplateCooldown: (value: string) => void;
  templateWarmupTime: string;
  setTemplateWarmupTime: (value: string) => void;
  templateMainTime: string;
  setTemplateMainTime: (value: string) => void;
  templateCooldownTime: string;
  setTemplateCooldownTime: (value: string) => void;
  templateSuggestions: string[];
  hasTemplateContent: boolean;
  templateEditorComposerHeight: number;
  templateEditorKeyboardHeight: number;
  setTemplateEditorComposerHeight: (value: number) => void;
  isTemplateEditorDirty: boolean;
  canDeleteTemplate: boolean;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function TemplateEditorModalContentBase({
  templateTitle,
  setTemplateTitle,
  templateAge,
  setTemplateAge,
  templateTags,
  setTemplateTags,
  templateWarmup,
  setTemplateWarmup,
  templateMain,
  setTemplateMain,
  templateCooldown,
  setTemplateCooldown,
  templateWarmupTime,
  setTemplateWarmupTime,
  templateMainTime,
  setTemplateMainTime,
  templateCooldownTime,
  setTemplateCooldownTime,
  templateSuggestions,
  hasTemplateContent,
  templateEditorComposerHeight,
  templateEditorKeyboardHeight,
  setTemplateEditorComposerHeight,
  isTemplateEditorDirty,
  canDeleteTemplate,
  onSave,
  onDuplicate,
  onDelete,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={{
        gap: 10,
        paddingVertical: 10,
        paddingBottom: templateEditorComposerHeight + templateEditorKeyboardHeight + 12,
        paddingHorizontal: 12,
      }}
      style={{ maxHeight: "92%", marginTop: 16 }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Título do modelo</Text>
          <TextInput
            placeholder="Título do modelo"
            value={templateTitle}
            onChangeText={setTemplateTitle}
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 10,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              fontSize: 13,
            }}
          />
        </View>
        <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Faixa etária</Text>
          <TextInput
            placeholder="Faixa etária (ex: 10-12)"
            value={templateAge}
            onChangeText={setTemplateAge}
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 10,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              fontSize: 13,
            }}
          />
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Tags (opcional)</Text>
        <TextInput
          placeholder="Tags (opcional, separe por vírgula)"
          value={templateTags}
          onChangeText={setTemplateTags}
          placeholderTextColor={colors.placeholder}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            padding: 10,
            borderRadius: 10,
            backgroundColor: colors.inputBg,
            color: colors.inputText,
            fontSize: 13,
          }}
        />
      </View>

      {templateSuggestions.length > 0 && hasTemplateContent ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, marginTop: 2 }}>Sugestões</Text>
          <FadeHorizontalScroll
            fadeColor={colors.card}
            contentContainerStyle={{ flexDirection: "row", gap: 8 }}
          >
            {templateSuggestions.map((tag) => (
              <Pressable
                key={tag}
                onPress={() =>
                  setTemplateTags(
                    templateTags.trim()
                      ? templateTags.trim().replace(/\s*,\s*$/, "") + ", " + tag
                      : tag
                  )
                }
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text }}>{tag}</Text>
              </Pressable>
            ))}
          </FadeHorizontalScroll>
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Aquecimento</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            placeholder="Aquecimento (1 por linha)"
            value={templateWarmup}
            onChangeText={setTemplateWarmup}
            multiline
            placeholderTextColor={colors.placeholder}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 8,
              paddingVertical: 14,
              borderRadius: 10,
              minHeight: 60,
              backgroundColor: colors.inputBg,
              textAlignVertical: "center",
              color: colors.inputText,
              fontSize: 13,
            }}
          />
          <TimeInput
            placeholder="10:00 (min:seg)"
            value={templateWarmupTime}
            onChangeText={setTemplateWarmupTime}
            format="duration"
            style={{ width: 110 }}
          />
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Parte principal</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            placeholder="Parte principal (1 por linha)"
            value={templateMain}
            onChangeText={setTemplateMain}
            multiline
            placeholderTextColor={colors.placeholder}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 8,
              paddingVertical: 20,
              borderRadius: 10,
              minHeight: 80,
              backgroundColor: colors.inputBg,
              textAlignVertical: "center",
              color: colors.inputText,
              fontSize: 13,
            }}
          />
          <TimeInput
            placeholder="01:30 (h:min)"
            value={templateMainTime}
            onChangeText={setTemplateMainTime}
            format="clock"
            style={{ width: 110 }}
          />
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Volta a calma</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            placeholder="Volta a calma (1 por linha)"
            value={templateCooldown}
            onChangeText={setTemplateCooldown}
            multiline
            placeholderTextColor={colors.placeholder}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 8,
              paddingVertical: 14,
              borderRadius: 10,
              minHeight: 60,
              backgroundColor: colors.inputBg,
              textAlignVertical: "center",
              color: colors.inputText,
              fontSize: 13,
            }}
          />
          <TimeInput
            placeholder="05:00 (min:seg)"
            value={templateCooldownTime}
            onChangeText={setTemplateCooldownTime}
            format="duration"
            style={{ width: 110 }}
          />
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

      <View
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          if (next !== templateEditorComposerHeight) {
            setTemplateEditorComposerHeight(next);
          }
        }}
      >
        <Pressable
          onPress={onSave}
          disabled={!isTemplateEditorDirty}
          style={{
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: isTemplateEditorDirty ? colors.primaryBg : colors.primaryDisabledBg,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: isTemplateEditorDirty ? colors.primaryText : colors.secondaryText,
              fontWeight: "700",
            }}
          >
            Salvar modelo
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={onDuplicate}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Duplicar modelo</Text>
        </Pressable>
        {canDeleteTemplate ? (
          <Pressable
            onPress={onDelete}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.dangerBg,
              borderWidth: 1,
              borderColor: colors.dangerBorder,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Excluir modelo</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

export const TemplateEditorModalContent = memo(TemplateEditorModalContentBase);
TemplateEditorModalContent.displayName = "TemplateEditorModalContent";
