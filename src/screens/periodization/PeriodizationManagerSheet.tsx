import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";

import type { ThemeColors } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";

export type PeriodizationManagerSection =
  "cycle" | "agenda" | "class" | "exceptions";

type SectionConfig = {
  id: PeriodizationManagerSection;
  label: string;
  caption: string;
  icon: GoAtletaIconName;
};

const sections: SectionConfig[] = [
  {
    id: "cycle",
    label: "Ciclo",
    caption: "Estrutura e intervalos",
    icon: "periodization",
  },
  {
    id: "agenda",
    label: "Agenda",
    caption: "Sessões e calendário",
    icon: "calendar",
  },
  {
    id: "class",
    label: "Turma",
    caption: "Objetivo, nível e duração",
    icon: "students",
  },
  {
    id: "exceptions",
    label: "Exceções",
    caption: "Competição e pausas",
    icon: "warningCircle",
  },
];

type Props = {
  visible: boolean;
  colors: ThemeColors;
  className: string;
  activeSection: PeriodizationManagerSection;
  onActiveSectionChange: (section: PeriodizationManagerSection) => void;
  onClose: () => void;
  cycleContent: ReactNode;
  agendaContent: ReactNode;
  classContent: ReactNode;
  exceptionsContent: ReactNode;
};

export function PeriodizationManagerSheet({
  visible,
  colors,
  className,
  activeSection,
  onActiveSectionChange,
  onClose,
  cycleContent,
  agendaContent,
  classContent,
  exceptionsContent,
}: Props) {
  const { width, height } = useWindowDimensions();
  const compact = width < 760;
  const [mountedOnce, setMountedOnce] = useState(visible);

  useEffect(() => {
    if (visible) setMountedOnce(true);
  }, [visible]);

  const content =
    activeSection === "cycle"
      ? cycleContent
      : activeSection === "agenda"
        ? agendaContent
        : activeSection === "class"
          ? classContent
          : exceptionsContent;

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="bottom"
      containerPadding={0}
      backdropOpacity={0.64}
      cardStyle={{
        alignSelf: "center",
        width: compact ? width : "100%",
        maxWidth: compact ? width : 1320,
        minWidth: 0,
        height: Math.min(height * 0.88, 900),
        borderTopLeftRadius: compact ? 20 : 24,
        borderTopRightRadius: compact ? 20 : 24,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        overflow: "hidden",
      }}
    >
      {mountedOnce ? (
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: "100%",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              minHeight: 76,
              width: "100%",
              maxWidth: "100%",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: compact ? 16 : 24,
              paddingRight: compact ? 68 : 24,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}
              >
                Gerenciar periodização
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}
              >
                {className}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar gerenciamento"
              onPress={onClose}
              style={{
                ...(compact ? { position: "absolute", right: 14 } : null),
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
              }}
            >
              <GoAtletaIcon name="close" size={19} color={colors.text} />
            </Pressable>
          </View>

          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: "100%",
              flexDirection: compact ? "column" : "row",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {compact ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ padding: 10, gap: 8 }}
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  flexGrow: 0,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                {sections.map((section) => {
                  const active = section.id === activeSection;
                  return (
                    <Pressable
                      key={section.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => onActiveSectionChange(section.id)}
                      style={{
                        minHeight: 42,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 7,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: active
                          ? colors.successBg
                          : colors.secondaryBg,
                      }}
                    >
                      <GoAtletaIcon
                        name={section.icon}
                        size={16}
                        color={active ? colors.successText : colors.muted}
                      />
                      <Text
                        style={{
                          color: active ? colors.successText : colors.text,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {section.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View
                style={{
                  width: 250,
                  padding: 12,
                  gap: 5,
                  borderRightWidth: 1,
                  borderRightColor: colors.border,
                }}
              >
                {sections.map((section) => {
                  const active = section.id === activeSection;
                  return (
                    <Pressable
                      key={section.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => onActiveSectionChange(section.id)}
                      style={{
                        minHeight: 66,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 11,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: active
                          ? colors.successBg
                          : "transparent",
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: active
                            ? colors.background
                            : colors.secondaryBg,
                        }}
                      >
                        <GoAtletaIcon
                          name={section.icon}
                          size={17}
                          color={active ? colors.successText : colors.muted}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            color: active ? colors.successText : colors.text,
                            fontSize: 13,
                            fontWeight: "700",
                          }}
                        >
                          {section.label}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.muted,
                            fontSize: 10,
                            marginTop: 2,
                          }}
                        >
                          {section.caption}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              contentContainerStyle={{
                width: "100%",
                maxWidth: "100%",
                padding: compact ? 14 : 22,
                gap: 16,
                paddingBottom: 40,
              }}
              style={{
                flex: 1,
                width: "100%",
                maxWidth: "100%",
                minHeight: 0,
                minWidth: 0,
              }}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                {content}
              </View>
            </ScrollView>
          </View>

          <View
            style={{
              minHeight: 66,
              width: "100%",
              maxWidth: "100%",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingHorizontal: compact ? 14 : 22,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ minWidth: compact ? "100%" : 150 }}>
              <Button label="Fechar" variant="secondary" onPress={onClose} />
            </View>
          </View>
        </View>
      ) : null}
    </ModalSheet>
  );
}
