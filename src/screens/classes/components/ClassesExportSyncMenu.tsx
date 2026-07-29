import {
  cacheDirectory,
  documentDirectory,
  EncodingType,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { useCollapsibleAnimation } from "../../../ui/use-collapsible";
import { useSaveToast } from "../../../ui/save-toast";
import { exportWorkbookXlsx, slugify } from "../../../utils/export-xlsx";
import type { ClassCardViewModel } from "../application/class-card-view-model";
import {
  buildClassesIcs,
  buildClassesWorkbookRows,
} from "../application/classes-export";

type Props = {
  classes: ClassGroup[];
  classCardViewModelsById: Record<string, ClassCardViewModel>;
  colors: ThemeColors;
  googleAccountConnected: boolean;
  compact?: boolean;
};

type TriggerLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/u/0/r/settings/export";

const getExportBaseName = () => {
  const date = new Date();
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
  return `turmas-goatleta-${stamp}`;
};

async function exportIcsFile(fileName: string, content: string) {
  if (Platform.OS === "web") {
    if (typeof document === "undefined") {
      throw new Error("Exportação de agenda indisponível neste navegador.");
    }
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }

  const baseDir = documentDirectory ?? cacheDirectory ?? "";
  if (!baseDir) throw new Error("Armazenamento indisponível para exportar agenda.");
  const uri = `${baseDir}${fileName}`;
  await writeAsStringAsync(uri, content, { encoding: EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: "Exportar agenda",
      mimeType: "text/calendar",
      UTI: "public.calendar-event",
    });
  }
}

export function ClassesExportSyncMenu({
  classes,
  classCardViewModelsById,
  colors,
  googleAccountConnected,
  compact = false,
}: Props) {
  const { showSaveToast } = useSaveToast();
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<TriggerLayout | null>(null);
  const [workingAction, setWorkingAction] = useState<"xlsx" | "ics" | "google" | null>(
    null
  );
  const { animatedStyle, isVisible } = useCollapsibleAnimation(open, {
    durationIn: 170,
    durationOut: 130,
    translateY: -6,
  });

  const exportDetailsById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(classCardViewModelsById).map(([classId, viewModel]) => [
          classId,
          {
            studentCount: viewModel.studentCount,
            teacherName: viewModel.teacher.name,
          },
        ])
      ),
    [classCardViewModelsById]
  );

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const menuWidth = compact ? Math.min(286, Math.max(240, width)) : 296;
      setTriggerLayout({
        x: Math.max(12, x + width - menuWidth),
        y,
        width: menuWidth,
        height,
      });
      setOpen(true);
    });
  }, [close, compact, open]);

  const runAction = useCallback(
    async (
      action: "xlsx" | "ics" | "google",
      task: () => Promise<void>,
      successMessage: string
    ) => {
      if (!classes.length || workingAction) return;
      setWorkingAction(action);
      close();
      try {
        await task();
        showSaveToast({ message: successMessage, variant: "success" });
      } catch (error) {
        showSaveToast({
          message: "Não foi possível concluir a exportação.",
          error,
          variant: "error",
        });
      } finally {
        setWorkingAction(null);
      }
    },
    [classes.length, close, showSaveToast, workingAction]
  );

  const exportXlsx = useCallback(
    () =>
      runAction(
        "xlsx",
        async () => {
          const rows = buildClassesWorkbookRows(classes, exportDetailsById);
          await exportWorkbookXlsx({
            fileName: `${slugify(getExportBaseName())}.xlsx`,
            dialogTitle: "Exportar lista de turmas",
            sheets: [
              {
                name: "Turmas",
                rows,
                options: {
                  freezeHeaderRow: true,
                  autoFilterHeaderRow: true,
                  autoSizeColumns: true,
                },
              },
            ],
          });
        },
        "Lista de turmas exportada."
      ),
    [classes, exportDetailsById, runAction]
  );

  const exportIcs = useCallback(
    () =>
      runAction(
        "ics",
        () => exportIcsFile(`${getExportBaseName()}.ics`, buildClassesIcs(classes)),
        "Agenda de turmas exportada."
      ),
    [classes, runAction]
  );

  const openGoogleCalendar = useCallback(
    () =>
      runAction(
        "google",
        async () => {
          await exportIcsFile(
            `${getExportBaseName()}-google-agenda.ics`,
            buildClassesIcs(classes)
          );
          await Linking.openURL(GOOGLE_CALENDAR_URL);
        },
        "Agenda pronta para importar no Google."
      ),
    [classes, runAction]
  );

  const disabled = !classes.length || workingAction !== null;
  const iconColor = colors.textMuted ?? colors.muted;
  const rowTextColor = colors.textPrimary ?? colors.text;

  return (
    <>
      <View ref={triggerRef}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exportar e sincronizar"
          accessibilityState={{ expanded: open, disabled }}
          onPress={toggle}
          disabled={disabled}
          style={(state) => ({
            height: 40,
            minWidth: compact ? 42 : 204,
            paddingHorizontal: compact ? 11 : 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: open
              ? colors.borderStrong ?? colors.border
              : colors.borderSubtle ?? colors.border,
            backgroundColor: state.hovered
              ? colors.backgroundSubtle ?? colors.secondaryBg
              : "transparent",
            opacity: disabled ? 0.55 : 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          })}
        >
          {compact ? (
            <GoAtletaIcon name="download" size={17} color={rowTextColor} />
          ) : (
            <Text style={{ color: rowTextColor, fontSize: 12, fontWeight: "800" }}>
              Exportar e sincronizar
            </Text>
          )}
          <GoAtletaIcon
            name="chevronDown"
            size={15}
            color={iconColor}
            style={{
              transform: [{ rotate: open ? "180deg" : "0deg" }],
            }}
          />
        </Pressable>
      </View>

      <AnchoredDropdown
        visible={isVisible}
        layout={triggerLayout}
        container={null}
        animationStyle={animatedStyle}
        zIndex={1300}
        maxHeight={248}
        nestedScrollEnabled
        density="menu"
        interactiveRefs={[triggerRef]}
        onRequestClose={close}
        showVerticalScrollIndicator={false}
        panelStyle={{ backgroundColor: colors.surfaceElevated ?? colors.card }}
        scrollContentStyle={{ padding: 8, gap: 2 }}
      >
        <MenuRow
          icon="download"
          label="Exportar lista (.xlsx)"
          colors={colors}
          onPress={exportXlsx}
        />
        <MenuRow
          icon="calendar"
          label="Exportar agenda (.ics)"
          colors={colors}
          onPress={exportIcs}
        />
        <View
          style={{
            height: 1,
            marginVertical: 5,
            backgroundColor: colors.borderSubtle ?? colors.border,
          }}
        />
        <MenuRow
          icon="sync"
          label="Sincronizar com Google Agenda"
          helper="Baixar agenda e abrir importação"
          colors={colors}
          onPress={openGoogleCalendar}
        />
        <View
          style={{
            minHeight: 30,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: googleAccountConnected
                ? colors.success
                : colors.textMuted ?? colors.muted,
            }}
          />
          <Text style={{ color: iconColor, fontSize: 11, fontWeight: "600" }}>
            {googleAccountConnected ? "Google conectado" : "Google não conectado"}
          </Text>
        </View>
      </AnchoredDropdown>
    </>
  );
}

function MenuRow({
  icon,
  label,
  helper,
  colors,
  onPress,
}: {
  icon: "download" | "calendar" | "sync";
  label: string;
  helper?: string;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => ({
        minHeight: helper ? 52 : 40,
        paddingHorizontal: 10,
        paddingVertical: helper ? 7 : 5,
        borderRadius: 9,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        backgroundColor: state.hovered
          ? colors.backgroundSubtle ?? colors.secondaryBg
          : "transparent",
      })}
    >
      <GoAtletaIcon
        name={icon}
        size={18}
        color={colors.textSecondary ?? colors.secondaryText}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary ?? colors.text,
            fontSize: 11,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
        {helper ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 2,
              color: colors.textMuted ?? colors.muted,
              fontSize: 9.5,
              fontWeight: "500",
            }}
          >
            {helper}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
