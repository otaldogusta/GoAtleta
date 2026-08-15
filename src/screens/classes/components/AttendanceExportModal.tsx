import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { getAttendanceAll, getStudents } from "../../../db/students";
import { AttendanceSummaryDocument } from "../../../pdf/attendance-summary-document";
import { exportPdf, safeFileName } from "../../../pdf/export-pdf";
import {
  attendanceSummaryHtml,
  type AttendanceSummaryPdfData,
} from "../../../pdf/templates/attendance-summary";
import { DateInput } from "../../../ui/DateInput";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useSaveToast } from "../../../ui/save-toast";
import { exportWorkbookXlsx, slugify } from "../../../utils/export-xlsx";
import { buildAttendanceExportData } from "../application/attendance-export";

type Props = {
  visible: boolean;
  onClose: () => void;
  classes: ClassGroup[];
  organizationId: string | null;
  organizationName: string;
};

type SelectorOption = { value: string; label: string };

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getInitialPeriod = () => {
  const now = new Date();
  return {
    start: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toLocalIsoDate(now),
  };
};

const addOneDay = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return toLocalIsoDate(new Date(year, month - 1, day + 1));
};

const formatDate = (isoDate: string) => isoDate.split("-").reverse().join("/");

function InlineSelector({
  label,
  value,
  options,
  open,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  options: SelectorOption[];
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <View style={{ flex: 1, minWidth: 180, gap: 5 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={{
          minHeight: 50,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" }}>
          {selected?.label}
        </Text>
        <GoAtletaIcon name="chevronDown" size={15} color={colors.muted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open ? (
        <ScrollView
          nestedScrollEnabled
          style={{ maxHeight: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card }}
          contentContainerStyle={{ padding: 6, gap: 2 }}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelect(option.value)}
                style={{ minHeight: 38, borderRadius: 9, paddingHorizontal: 10, justifyContent: "center", backgroundColor: active ? colors.primaryBg : "transparent" }}
              >
                <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12, fontWeight: active ? "800" : "600" }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function AttendanceExportModal({
  visible,
  onClose,
  classes,
  organizationId,
  organizationName,
}: Props) {
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const initialPeriod = useMemo(getInitialPeriod, []);
  const [startDate, setStartDate] = useState(initialPeriod.start);
  const [endDate, setEndDate] = useState(initialPeriod.end);
  const [unit, setUnit] = useState("all");
  const [classId, setClassId] = useState("all");
  const [openSelector, setOpenSelector] = useState<"unit" | "class" | null>(null);
  const [workingFormat, setWorkingFormat] = useState<"pdf" | "xlsx" | null>(null);

  const unitOptions = useMemo<SelectorOption[]>(
    () => [
      { value: "all", label: "Todas as unidades" },
      ...Array.from(new Set(classes.map((item) => item.unit).filter(Boolean)))
        .sort((left, right) => left.localeCompare(right, "pt-BR"))
        .map((value) => ({ value, label: value })),
    ],
    [classes]
  );
  const scopedClasses = useMemo(
    () => classes.filter((item) => unit === "all" || item.unit === unit),
    [classes, unit]
  );
  const classOptions = useMemo<SelectorOption[]>(
    () => [
      { value: "all", label: "Todas as turmas" },
      ...scopedClasses
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
        .map((item) => ({ value: item.id, label: item.name })),
    ],
    [scopedClasses]
  );

  useEffect(() => {
    if (classId === "all" || scopedClasses.some((item) => item.id === classId)) return;
    setClassId("all");
  }, [classId, scopedClasses]);

  const scopeLabel = useMemo(() => {
    const selectedClass = classes.find((item) => item.id === classId);
    if (selectedClass) return `${selectedClass.unit} · ${selectedClass.name}`;
    if (unit !== "all") return `${unit} · Todas as turmas`;
    return "Todas as unidades e turmas";
  }, [classId, classes, unit]);

  const runExport = async (format: "pdf" | "xlsx") => {
    if (!organizationId || workingFormat) return;
    if (!startDate || !endDate || startDate > endDate) {
      showSaveToast({ message: "Informe um período válido.", variant: "error" });
      return;
    }
    setWorkingFormat(format);
    try {
      const [records, students] = await Promise.all([
        getAttendanceAll({
          organizationId,
          startIso: startDate,
          endIso: addOneDay(endDate),
        }),
        getStudents({ organizationId }),
      ]);
      const data = buildAttendanceExportData({
        classes,
        students,
        records,
        startDate,
        endDate,
        unit: unit === "all" ? null : unit,
        classId: classId === "all" ? null : classId,
      });
      if (!data.totalRecords) {
        throw new Error("Nenhuma chamada encontrada para o período e escopo selecionados.");
      }
      const fileScope = classId !== "all" ? classes.find((item) => item.id === classId)?.name ?? "turma" : unit !== "all" ? unit : "organizacao";
      const fileBase = `chamadas-${safeFileName(fileScope)}-${startDate}-${endDate}`;
      if (format === "xlsx") {
        await exportWorkbookXlsx({
          fileName: `${slugify(fileBase)}.xlsx`,
          dialogTitle: "Exportar chamadas",
          sheets: [
            {
              name: "Resumo",
              rows: [
                ["Unidade", "Turma", "Aulas", "Presenças", "Faltas", "Frequência"],
                ...data.summary.map((row) => [row.unit, row.className, row.sessions, row.present, row.absent, `${row.attendanceRate}%`]),
              ],
              options: { freezeHeaderRow: true, autoFilterHeaderRow: true, autoSizeColumns: true },
            },
            {
              name: "Registros",
              rows: [
                ["Data", "Unidade", "Turma", "Atleta", "Vínculo", "Financeiro", "Presença", "Observação", "Dor"],
                ...data.details.map((row) => [formatDate(row.date), row.unit, row.className, row.studentName, row.membershipStatus, row.financialStatus, row.attendanceStatus, row.note, row.painScore]),
              ],
              options: { freezeHeaderRow: true, autoFilterHeaderRow: true, autoSizeColumns: true },
            },
          ],
        });
      } else {
        const pdfData: AttendanceSummaryPdfData = {
          organizationName,
          periodLabel: `${formatDate(startDate)} a ${formatDate(endDate)}`,
          scopeLabel,
          exportedAt: new Date().toLocaleString("pt-BR"),
          ...data,
          rows: data.summary,
        };
        await exportPdf({
          html: attendanceSummaryHtml(pdfData),
          fileName: `${fileBase}.pdf`,
          webDocument: <AttendanceSummaryDocument data={pdfData} />,
        });
      }
      showSaveToast({
        message: `${data.totalRecords} registro(s) exportado(s) em ${format.toUpperCase()}.`,
        variant: "success",
      });
      onClose();
    } catch (error) {
      showSaveToast({ message: "Não foi possível exportar as chamadas.", error, variant: "error" });
    } finally {
      setWorkingFormat(null);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      cardStyle={{ width: "100%", maxWidth: 560, maxHeight: "88%", padding: 0, overflow: "hidden" }}
    >
      <View style={{ paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Exportar chamadas</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Período, unidade e turma em um só lugar.</Text>
        </View>
        <Pressable accessibilityLabel="Fechar" onPress={onClose} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
          <GoAtletaIcon name="close" size={17} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 180, gap: 5 }}><Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>De</Text><DateInput value={startDate} onChange={setStartDate} placeholder="Data inicial" /></View>
          <View style={{ flex: 1, minWidth: 180, gap: 5 }}><Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Até</Text><DateInput value={endDate} onChange={setEndDate} placeholder="Data final" /></View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          <InlineSelector label="Unidade" value={unit} options={unitOptions} open={openSelector === "unit"} onToggle={() => setOpenSelector((current) => current === "unit" ? null : "unit")} onSelect={(value) => { setUnit(value); setClassId("all"); setOpenSelector(null); }} />
          <InlineSelector label="Turma" value={classId} options={classOptions} open={openSelector === "class"} onToggle={() => setOpenSelector((current) => current === "class" ? null : "class")} onSelect={(value) => { setClassId(value); setOpenSelector(null); }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Pressable disabled={workingFormat !== null} onPress={() => void runExport("pdf")} style={{ flex: 1, minWidth: 180, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: workingFormat ? 0.55 : 1 }}>
            <GoAtletaIcon name="document" size={17} color={colors.text} /><Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{workingFormat === "pdf" ? "Gerando PDF..." : "PDF resumido"}</Text>
          </Pressable>
          <Pressable disabled={workingFormat !== null} onPress={() => void runExport("xlsx")} style={{ flex: 1, minWidth: 180, minHeight: 48, borderRadius: 12, backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: workingFormat ? 0.55 : 1 }}>
            <GoAtletaIcon name="download" size={17} color={colors.primaryText} /><Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: "800" }}>{workingFormat === "xlsx" ? "Gerando XLSX..." : "XLSX detalhado"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ModalSheet>
  );
}
