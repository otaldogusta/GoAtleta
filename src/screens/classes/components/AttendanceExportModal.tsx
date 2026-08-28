import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { getMyMemberPermissions } from "../../../api/members";
import type { ClassStaffAssignment } from "../../../api/class-responsibles";
import type { ClassGroup } from "../../../core/models";
import {
  formatOrganizationDateTime,
  getOrganizationMonthToDatePeriod,
  resolveOrganizationTimeZone,
} from "../../../core/organization-timezone";
import {
  getAttendanceExportRecords,
  getAttendanceExportStudents,
  type AttendanceExportStudent,
} from "../../../db/students";
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
import {
  buildAttendanceExportData,
  buildAttendanceExportFileParts,
  type AttendanceExportMembershipFilter,
  type AttendanceExportStatusFilter,
} from "../application/attendance-export";

type Props = {
  visible: boolean;
  onClose: () => void;
  classes: ClassGroup[];
  classStaffAssignments: ClassStaffAssignment[];
  organizationId: string | null;
  organizationName: string;
  organizationTimeZone?: string | null;
  allowed: boolean;
  isOrgAdmin: boolean;
};

type SelectorOption = { value: string; label: string };

const NO_ATTENDANCE_MESSAGE = "Nenhuma chamada encontrada para o período e filtros selecionados.";
const NO_REPORTS_PERMISSION_MESSAGE = "Seu acesso a relatórios não permite exportar chamadas.";

const addOneDay = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  return nextDate.toISOString().slice(0, 10);
};

const formatDate = (isoDate: string) => isoDate.split("-").reverse().join("/");

function InlineSelector({
  label,
  value,
  options,
  open,
  disabled = false,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  options: SelectorOption[];
  open: boolean;
  disabled?: boolean;
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
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
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
          opacity: disabled ? 0.55 : 1,
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
                style={{ minHeight: 44, borderRadius: 9, paddingHorizontal: 10, justifyContent: "center", backgroundColor: active ? colors.primaryBg : "transparent" }}
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
  classStaffAssignments,
  organizationId,
  organizationName,
  organizationTimeZone,
  allowed,
  isOrgAdmin,
}: Props) {
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const resolvedTimeZone = useMemo(
    () => resolveOrganizationTimeZone(organizationTimeZone),
    [organizationTimeZone],
  );
  const initialPeriod = useMemo(
    () => getOrganizationMonthToDatePeriod(new Date(), resolvedTimeZone),
    [resolvedTimeZone],
  );
  const [startDate, setStartDate] = useState(initialPeriod.start);
  const [endDate, setEndDate] = useState(initialPeriod.end);
  const [professorId, setProfessorId] = useState("all");
  const [unit, setUnit] = useState("all");
  const [classId, setClassId] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceExportStatusFilter>("all");
  const [membershipStatus, setMembershipStatus] = useState<AttendanceExportMembershipFilter>("all");
  const [availableStudents, setAvailableStudents] = useState<AttendanceExportStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [openSelector, setOpenSelector] = useState<"professor" | "unit" | "class" | "student" | "attendance" | "membership" | null>(null);
  const [workingFormat, setWorkingFormat] = useState<"pdf" | "xlsx" | null>(null);

  const professorAssignments = useMemo(
    () => classStaffAssignments.filter((assignment) => assignment.staffRole !== "intern"),
    [classStaffAssignments],
  );
  const professorOptions = useMemo<SelectorOption[]>(() => {
    const namesByUserId = new Map<string, string>();
    professorAssignments.forEach((assignment) => {
      if (!namesByUserId.has(assignment.userId)) {
        namesByUserId.set(
          assignment.userId,
          assignment.displayName?.trim() || "Professor sem nome",
        );
      }
    });
    return [
      { value: "all", label: "Todos os professores" },
      ...Array.from(namesByUserId, ([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    ];
  }, [professorAssignments]);
  const effectiveProfessorId = professorOptions.some((option) => option.value === professorId)
    ? professorId
    : "all";
  const professorScopedClassIds = useMemo(() => {
    if (effectiveProfessorId === "all") return null;
    return new Set(
      professorAssignments
        .filter((assignment) => assignment.userId === effectiveProfessorId)
        .map((assignment) => assignment.classId),
    );
  }, [effectiveProfessorId, professorAssignments]);
  const professorScopedClasses = useMemo(
    () => classes.filter((item) => !professorScopedClassIds || professorScopedClassIds.has(item.id)),
    [classes, professorScopedClassIds],
  );
  const unitOptions = useMemo<SelectorOption[]>(
    () => [
      { value: "all", label: "Todas as unidades" },
      ...Array.from(new Set(professorScopedClasses.map((item) => item.unit).filter(Boolean)))
        .sort((left, right) => left.localeCompare(right, "pt-BR"))
        .map((value) => ({ value, label: value })),
    ],
    [professorScopedClasses]
  );
  const scopedClasses = useMemo(
    () => professorScopedClasses.filter((item) => unit === "all" || item.unit === unit),
    [professorScopedClasses, unit]
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
  const studentOptions = useMemo<SelectorOption[]>(
    () => [
      { value: "all", label: "Todos os atletas" },
      ...availableStudents
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
        .map((student) => ({
          value: student.id,
          label: `${student.name}${student.membershipStatus === "inactive" ? " · Inativo" : ""}`,
        })),
    ],
    [availableStudents]
  );
  const attendanceOptions = useMemo<SelectorOption[]>(
    () => [
      { value: "all", label: "Presenças e faltas" },
      { value: "presente", label: "Somente presenças" },
      { value: "faltou", label: "Somente faltas" },
    ],
    []
  );
  const membershipOptions = useMemo<SelectorOption[]>(
    () => [
      { value: "all", label: "Ativos e inativos" },
      { value: "active", label: "Somente ativos" },
      { value: "inactive", label: "Somente inativos" },
    ],
    []
  );

  useEffect(() => {
    let active = true;
    if (!visible || !allowed || !organizationId) return () => { active = false; };
    void Promise.resolve().then(async () => {
      if (!active) return;
      setAvailableStudents([]);
      setIsLoadingStudents(true);
      try {
        if (!isOrgAdmin) {
          const currentPermissions = await getMyMemberPermissions(organizationId);
          const reportsAllowed = currentPermissions.some((permission) =>
            permission.permissionKey === "reports" && permission.isAllowed
          );
          if (!reportsAllowed) {
            if (active) setAvailableStudents([]);
            return;
          }
        }
        const students = await getAttendanceExportStudents({ organizationId });
        if (!active) return;
        setAvailableStudents(students);
        setStudentId((current) =>
          current === "all" || students.some((student) => student.id === current)
            ? current
            : "all"
        );
      } catch {
        if (active) setAvailableStudents([]);
      } finally {
        if (active) setIsLoadingStudents(false);
      }
    });
    return () => {
      active = false;
    };
  }, [allowed, isOrgAdmin, organizationId, visible]);

  useEffect(() => {
    if (classId === "all" || scopedClasses.some((item) => item.id === classId)) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setClassId("all");
    });
    return () => {
      active = false;
    };
  }, [classId, scopedClasses]);

  const scopeLabel = useMemo(() => {
    const selectedClass = classes.find((item) => item.id === classId);
    const selectedStudent = availableStudents.find((item) => item.id === studentId);
    const selectedProfessor = professorOptions.find((item) => item.value === effectiveProfessorId);
    const labels = [
      selectedClass
        ? `${selectedClass.unit} · ${selectedClass.name}`
        : unit !== "all"
          ? `${unit} · Todas as turmas`
          : "Todas as unidades e turmas",
      effectiveProfessorId === "all" ? null : selectedProfessor?.label,
      selectedStudent?.name,
      attendanceStatus === "presente" ? "Somente presenças" : attendanceStatus === "faltou" ? "Somente faltas" : null,
      membershipStatus === "active" ? "Somente ativos" : membershipStatus === "inactive" ? "Somente inativos" : null,
    ].filter(Boolean);
    return labels.join(" · ");
  }, [attendanceStatus, availableStudents, classId, classes, effectiveProfessorId, membershipStatus, professorOptions, studentId, unit]);

  const runExport = async (format: "pdf" | "xlsx") => {
    if (!allowed || !organizationId || workingFormat) return;
    if (!startDate || !endDate || startDate > endDate) {
      showSaveToast({ message: "Informe um período válido.", variant: "error" });
      return;
    }
    setWorkingFormat(format);
    try {
      if (!isOrgAdmin) {
        const currentPermissions = await getMyMemberPermissions(organizationId);
        if (!currentPermissions.some((permission) =>
          permission.permissionKey === "reports" && permission.isAllowed
        )) {
          throw new Error(NO_REPORTS_PERMISSION_MESSAGE);
        }
      }
      const exportClassIds = classId !== "all"
        ? [classId]
        : unit !== "all" || effectiveProfessorId !== "all"
          ? scopedClasses.map((item) => item.id)
          : undefined;
      const [records, students] = await Promise.all([
        getAttendanceExportRecords({
          organizationId,
          startIso: startDate,
          endIso: addOneDay(endDate),
          classIds: exportClassIds,
          studentId: studentId === "all" ? null : studentId,
        }),
        getAttendanceExportStudents({ organizationId }),
      ]);
      setAvailableStudents(students);
      const data = buildAttendanceExportData({
        classes,
        students,
        records,
        classStaffAssignments: professorAssignments,
        startDate,
        endDate,
        unit: unit === "all" ? null : unit,
        classId: classId === "all" ? null : classId,
        professorId: effectiveProfessorId === "all" ? null : effectiveProfessorId,
        studentId: studentId === "all" ? null : studentId,
        attendanceStatus,
        membershipStatus,
      });
      if (!data.totalRecords) {
        throw new Error(NO_ATTENDANCE_MESSAGE);
      }
      const fileScope = classId !== "all" ? classes.find((item) => item.id === classId)?.name ?? "turma" : unit !== "all" ? unit : "organizacao";
      const selectedStudentName = studentId === "all"
        ? null
        : students.find((student) => student.id === studentId)?.name ??
          availableStudents.find((student) => student.id === studentId)?.name ??
          studentId;
      const selectedProfessorName = effectiveProfessorId === "all"
        ? null
        : professorOptions.find((option) => option.value === effectiveProfessorId)?.label ??
          effectiveProfessorId;
      const fileBase = buildAttendanceExportFileParts({
        scope: fileScope,
        professorName: selectedProfessorName,
        studentName: selectedStudentName,
        attendanceStatus,
        membershipStatus,
        startDate,
        endDate,
      })
        .map(safeFileName)
        .filter(Boolean)
        .join("-");
      const exportedAt = formatOrganizationDateTime(new Date(), resolvedTimeZone);
      if (format === "xlsx") {
        await exportWorkbookXlsx({
          fileName: `${slugify(fileBase)}.xlsx`,
          dialogTitle: "Exportar chamadas",
          sheets: [
            {
              name: "Contexto",
              rows: [
                ["Organização", organizationName],
                ["Período", `${formatDate(startDate)} a ${formatDate(endDate)}`],
                ["Filtros", scopeLabel],
                ["Fuso IANA", resolvedTimeZone],
                ["Exportado em", exportedAt],
              ],
              options: { autoSizeColumns: true },
            },
            {
              name: "Resumo",
              rows: [
                ["Unidade", "Turma", "Professor", "Datas com chamada", "Presenças", "Faltas", "Frequência"],
                ...data.summary.map((row) => [row.unit, row.className, row.professorNames, row.sessions, row.present, row.absent, `${row.attendanceRate}%`]),
              ],
              options: { freezeHeaderRow: true, autoFilterHeaderRow: true, autoSizeColumns: true },
            },
            {
              name: "Registros",
              rows: [
                ["Data", "Unidade", "Turma", "Professor", "Atleta", "Vínculo", "Presença"],
                ...data.details.map((row) => [formatDate(row.date), row.unit, row.className, row.professorNames, row.studentName, row.membershipStatus, row.attendanceStatus]),
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
          timeZone: resolvedTimeZone,
          exportedAt,
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
      const knownMessage = error instanceof Error && (
        error.message === NO_ATTENDANCE_MESSAGE ||
        error.message === NO_REPORTS_PERMISSION_MESSAGE ||
        error.message.includes("limite seguro de exportação") ||
        error.message.includes("retornou registros repetidos")
      )
        ? error.message
        : null;
      const message = knownMessage ?? "Não foi possível exportar as chamadas.";
      showSaveToast({ message, error, variant: "error" });
    } finally {
      setWorkingFormat(null);
    }
  };

  return (
    <ModalSheet
      visible={visible && allowed}
      onClose={onClose}
      position="center"
      cardStyle={{ width: "100%", maxWidth: 560, maxHeight: "88%", padding: 0, overflow: "hidden" }}
    >
      <View style={{ paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Exportar chamadas</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Escolha o período e os filtros necessários.</Text>
        </View>
        <Pressable accessibilityLabel="Fechar" onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
          <GoAtletaIcon name="close" size={17} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 180, gap: 5 }}><Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>De</Text><DateInput value={startDate} onChange={setStartDate} placeholder="Data inicial" /></View>
          <View style={{ flex: 1, minWidth: 180, gap: 5 }}><Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Até</Text><DateInput value={endDate} onChange={setEndDate} placeholder="Data final" /></View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          <InlineSelector label="Professor da turma" value={effectiveProfessorId} options={professorOptions} open={openSelector === "professor"} onToggle={() => setOpenSelector((current) => current === "professor" ? null : "professor")} onSelect={(value) => { setProfessorId(value); setUnit("all"); setClassId("all"); setOpenSelector(null); }} />
          <InlineSelector label="Unidade" value={unit} options={unitOptions} open={openSelector === "unit"} onToggle={() => setOpenSelector((current) => current === "unit" ? null : "unit")} onSelect={(value) => { setUnit(value); setClassId("all"); setOpenSelector(null); }} />
          <InlineSelector label="Turma" value={classId} options={classOptions} open={openSelector === "class"} onToggle={() => setOpenSelector((current) => current === "class" ? null : "class")} onSelect={(value) => { setClassId(value); setOpenSelector(null); }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          <InlineSelector label="Atleta" value={studentId} options={studentOptions} open={openSelector === "student"} disabled={isLoadingStudents} onToggle={() => setOpenSelector((current) => current === "student" ? null : "student")} onSelect={(value) => { setStudentId(value); setOpenSelector(null); }} />
          <InlineSelector label="Presença" value={attendanceStatus} options={attendanceOptions} open={openSelector === "attendance"} onToggle={() => setOpenSelector((current) => current === "attendance" ? null : "attendance")} onSelect={(value) => { setAttendanceStatus(value as AttendanceExportStatusFilter); setOpenSelector(null); }} />
          <InlineSelector label="Vínculo atual" value={membershipStatus} options={membershipOptions} open={openSelector === "membership"} onToggle={() => setOpenSelector((current) => current === "membership" ? null : "membership")} onSelect={(value) => { setMembershipStatus(value as AttendanceExportMembershipFilter); setOpenSelector(null); }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Pressable disabled={workingFormat !== null} onPress={() => void runExport("pdf")} style={{ flex: 1, minWidth: 180, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: workingFormat ? 0.55 : 1 }}>
            <GoAtletaIcon name="document" size={17} color={colors.text} /><Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{workingFormat === "pdf" ? "Gerando PDF..." : "PDF detalhado"}</Text>
          </Pressable>
          <Pressable disabled={workingFormat !== null} onPress={() => void runExport("xlsx")} style={{ flex: 1, minWidth: 180, minHeight: 48, borderRadius: 12, backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: workingFormat ? 0.55 : 1 }}>
            <GoAtletaIcon name="download" size={17} color={colors.primaryText} /><Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: "800" }}>{workingFormat === "xlsx" ? "Gerando XLSX..." : "XLSX detalhado"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ModalSheet>
  );
}
