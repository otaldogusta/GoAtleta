import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";

import { useAuth } from "../../../auth/auth";
import {
  buildAthleteIntakeSummary,
  mapGoogleFormsRowToAthleteIntake,
  normalizeAthleteModality,
} from "../../../core/athlete-intake";
import type { ClassGroup } from "../../../core/models";
import { syncGoogleFormsAthleteIntakes } from "../../../db/seed";
import {
    applyStudentsSync,
    listStudentsSyncRunLogs,
    previewStudentsSync,
    type StudentImportFunctionResult,
} from "../../../services/students-sync-service";
import { useAppTheme } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { resolveClassModality } from "../../../core/class-modality";
import { useConfirmDialog } from "../../../ui/confirm-dialog";
import { useCollapsibleAnimation } from "../../../ui/use-collapsible";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";
import { usePersistedState } from "../../../ui/use-persisted-state";
import { loadGoogleFormsSheetImport, type LoadedGoogleFormsSheet } from "../google-forms-sync";

const FLAG_DETAILS: Record<string, { title: string; hint: string }> = {
  NAME_CONFLICT: {
    title: "Nome divergente",
    hint: "Já existe cadastro parecido, mas o nome informado difere do cadastro atual.",
  },
  RA_CONFLICT: {
    title: "RA divergente",
    hint: "O RA informado na planilha difere do cadastro atual.",
  },
  EXTERNAL_ID_CONFLICT: {
    title: "Identificador externo divergente",
    hint: "O identificador externo da planilha difere do cadastro atual.",
  },
  CLASS_NOT_FOUND: {
    title: "Turma não encontrada",
    hint: "A turma informada na planilha não corresponde a uma turma cadastrada na organização ativa.",
  },
  CLASS_CONFLICT: {
    title: "Diferença de turma",
    hint: "O aluno já existe em outra turma. A sincronização mantém a turma atual e completa apenas os demais dados.",
  },
  LOW_CONFIDENCE_CLASS_MISMATCH: {
    title: "Conflito de turma (baixa confiança)",
    hint: "O sistema encontrou possível aluno existente em turma diferente e bloqueou a troca automática.",
  },
  DUPLICATE_INPUT_ROW: {
    title: "Linha duplicada na planilha",
    hint: "A mesma pessoa aparece mais de uma vez no Forms.",
  },
  LOW_CONFIDENCE_MATCH: {
    title: "Correspondência fraca",
    hint: "O sistema não teve segurança para atualizar automaticamente.",
  },
  BIRTHDATE_CONFLICT: {
    title: "Data de nascimento divergente",
    hint: "A data da planilha difere do cadastro atual. O aluno segue sincronizado e recebe aviso para revisão.",
  },
  BIRTHDATE_SUSPECT: {
    title: "Data de nascimento suspeita",
    hint: "A data parece inválida ou incompleta. O aluno é sincronizado com alerta visual até a correção.",
  },
  PHONE_CONFLICT: {
    title: "Telefone divergente",
    hint: "O telefone da planilha difere do cadastro atual.",
  },
  RG_CONFLICT: {
    title: "RG divergente",
    hint: "O RG da planilha difere do cadastro atual.",
  },
  ROW_ERROR: {
    title: "Erro na linha",
    hint: "A linha não pode ser processada automaticamente.",
  },
  LOGIN_EMAIL_CONFLICT: {
    title: "E-mail divergente",
    hint: "O e-mail da planilha difere do cadastro atual.",
  },
};

const getFlagDetail = (flag: string) =>
  FLAG_DETAILS[flag] ?? {
    title: flag.replace(/_/g, " ").toLowerCase(),
    hint: "Revise esta linha manualmente antes de aplicar.",
  };

const compactSheetId = (value: string) => {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length <= 28) return trimmed;
  return `${trimmed.slice(0, 14)}...${trimmed.slice(-8)}`;
};

const readConflictValue = (value: unknown, side: "incoming" | "existing" = "incoming") => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && side in (value as Record<string, unknown>)) {
    const selected = (value as Record<string, unknown>)[side];
    return typeof selected === "string" ? selected.trim() : "";
  }
  return "";
};

const buildApplyErrorHint = (
  rows: Array<{ rowNumber: number; errorMessage: string | null; flags?: string[] | null }>
) => {
  const samples = rows
    .map((row) => {
      const message = typeof row.errorMessage === "string" ? row.errorMessage.trim() : "";
      if (message) return `L${row.rowNumber}: ${message}`;
      const firstFlag = Array.isArray(row.flags) ? row.flags[0] : null;
      if (firstFlag) return `L${row.rowNumber}: ${getFlagDetail(firstFlag).title}`;
      return `L${row.rowNumber}: erro sem detalhe retornado`;
    })
    .slice(0, 3)
  if (!samples.length) return "";
  return ` Motivos: ${samples.join(" | ")}.`;
};

type StudentsFormsSyncModalProps = {
  visible: boolean;
  organizationId: string | null;
  classes: ClassGroup[];
  onClose: () => void;
  onImportApplied?: () => void;
};

type ApplyConfirmState = {
  mode: "all" | "safe" | null;
  title: string;
  message: string;
  confirmLabel: string;
};

type ModalityClassMap = Record<string, string | null>;
type RowDecision = "import" | "anamnesis" | "ignore";
type DropdownLayout = { x: number; y: number; width: number; height: number };

const ROW_DECISION_OPTIONS: Array<{ key: RowDecision; label: string }> = [
  { key: "import", label: "Importar" },
  { key: "anamnesis", label: "Anamnese" },
  { key: "ignore", label: "Ignorar" },
];

const getClassLabel = (item: ClassGroup) => {
  const gender = item.gender === "feminino" ? "Feminino" : item.gender === "masculino" ? "Masculino" : "Misto";
  return `${item.name} • ${item.unit} • ${gender}`;
};

const getEffectiveModalityClassId = (
  normalizedModality: string,
  modalityClassMap: ModalityClassMap,
  defaultClassId: string | null
) => {
  if (Object.prototype.hasOwnProperty.call(modalityClassMap, normalizedModality)) {
    return modalityClassMap[normalizedModality] ?? null;
  }
  return defaultClassId;
};

const shouldAutoAssignModality = (normalizedModality: string) =>
  resolveClassModality(normalizedModality) === "voleibol";

const getDefaultRowDecision = (intakeModalities: string[]) => {
  const hasVolleyball = intakeModalities.some((item) => normalizeAthleteModality(item) === "voleibol");
  return hasVolleyball ? "import" : "anamnesis";
};

const resolveAutoClassByUnitModality = (
  normalizedModality: string,
  selectedUnit: string,
  classes: ClassGroup[]
) => {
  if (!selectedUnit.trim()) return null;
  const targetModality = resolveClassModality(normalizedModality) ?? "fitness";

  const byModality = classes.filter((item) => item.modality === targetModality);
  const scoped = selectedUnit
    ? byModality.filter((item) => item.unit === selectedUnit)
    : byModality;
  const candidates = scoped.length ? scoped : byModality;
  if (!candidates.length) return null;

  const mixed = candidates.find((item) => item.gender === "misto");
  if (mixed) return mixed.id;
  return candidates[0]?.id ?? null;
};

const normalizeClassNameForGenderPair = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(masculino|feminino|misto)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const resolveGenderAwareClassId = (
  baseClassId: string,
  sex: "masculino" | "feminino" | "outro" | null,
  classes: ClassGroup[]
) => {
  if (!sex || (sex !== "masculino" && sex !== "feminino")) return baseClassId;
  const baseClass = classes.find((item) => item.id === baseClassId);
  if (!baseClass) return baseClassId;
  if (baseClass.gender === sex || baseClass.gender === "misto") return baseClassId;

  const normalizedBaseName = normalizeClassNameForGenderPair(baseClass.name);
  const sameUnitModality = classes.filter(
    (item) => item.unit === baseClass.unit && item.modality === baseClass.modality
  );
  const exactPair = sameUnitModality.find(
    (item) =>
      item.gender === sex &&
      normalizeClassNameForGenderPair(item.name) === normalizedBaseName
  );
  if (exactPair) return exactPair.id;

  const byGenderInSameUnitModality = sameUnitModality.find((item) => item.gender === sex);
  if (byGenderInSameUnitModality) return byGenderInSameUnitModality.id;

  return baseClassId;
};

export function StudentsFormsSyncModal({
  visible,
  organizationId,
  classes,
  onClose,
  onImportApplied,
}: StudentsFormsSyncModalProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { session } = useAuth();
  const cardStyle = useModalCardStyle({
    maxWidth: 560,
    maxHeight: "90%",
    padding: 16,
    radius: 20,
  });

  const [sheetUrl, setSheetUrl] = useState("");
  const [loadedSheet, setLoadedSheet] = useState<LoadedGoogleFormsSheet | null>(null);
  const [previewResult, setPreviewResult] = useState<StudentImportFunctionResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyProgress, setApplyProgress] = useState<{
    processed: number;
    total: number;
    label: string;
    detail?: string;
  } | null>(null);
  const [applyResultMessage, setApplyResultMessage] = useState<string | null>(null);
  const [applyConfirmState, setApplyConfirmState] = useState<ApplyConfirmState | null>(null);
  const [applyConfirmLoading, setApplyConfirmLoading] = useState(false);
  const [forceApplyConflictRows, setForceApplyConflictRows] = useState<number[]>([]);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [needsPreviewRefresh, setNeedsPreviewRefresh] = useState(false);
  const [showOtherModalities, setShowOtherModalities] = useState(false);
  const [showSheetPreview, setShowSheetPreview] = useState(false);
  const [showAllPreviewRows, setShowAllPreviewRows] = useState(false);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [unitDropdownLayout, setUnitDropdownLayout] = useState<DropdownLayout | null>(null);
  const [classDropdownLayout, setClassDropdownLayout] = useState<DropdownLayout | null>(null);
  const [dropdownContainer, setDropdownContainer] = useState<{ x: number; y: number } | null>(null);
  const [rowDecisions, setRowDecisions] = useState<Record<number, RowDecision>>({});
  const [selectedUnit, setSelectedUnit] = useState("");
  const dropdownContainerRef = useRef<View | null>(null);
  const unitTriggerRef = useRef<View | null>(null);
  const classTriggerRef = useRef<View | null>(null);
  const [storedModalityClassMap, setStoredModalityClassMap, storedModalityClassMapLoaded] = usePersistedState<ModalityClassMap>(
    organizationId ? `students-forms-modality-class-map:${organizationId}` : null,
    {}
  );
  const [storedDefaultClassId, setStoredDefaultClassId, storedDefaultClassIdLoaded] = usePersistedState<string | null>(
    organizationId ? `students-forms-default-class:${organizationId}` : null,
    null
  );
  const { animatedStyle: unitDropdownAnimationStyle, isVisible: showUnitDropdownContent } =
    useCollapsibleAnimation(showUnitDropdown, { translateY: -6 });
  const { animatedStyle: classDropdownAnimationStyle, isVisible: showClassDropdownContent } =
    useCollapsibleAnimation(showClassDropdown, { translateY: -6 });
  const summary = previewResult?.summary ?? null;
  const canApply = Boolean(
    summary &&
      loadedSheet &&
      summary.create + summary.update > 0 &&
      summary.conflict === 0 &&
      summary.error === 0
  );
  const safeRowsCount = summary ? summary.create + summary.update : 0;
  const conflictRows = useMemo(
    () => (previewResult?.rows ?? []).filter((row) => row.action === "conflict" || row.action === "error"),
    [previewResult]
  );
  const conflictOnlyRows = useMemo(
    () => (previewResult?.rows ?? []).filter((row) => row.action === "conflict"),
    [previewResult]
  );
  const validConflictRowNumbers = useMemo(
    () => new Set(conflictOnlyRows.map((row) => Number(row.rowNumber))),
    [conflictOnlyRows]
  );
  const selectedForceApplyRows = useMemo(
    () => forceApplyConflictRows.filter((rowNumber) => validConflictRowNumbers.has(Number(rowNumber))),
    [forceApplyConflictRows, validConflictRowNumbers]
  );
  const effectiveSafeRowsCount = safeRowsCount + selectedForceApplyRows.length;
  const topConflictFlags = useMemo(
    () =>
      Object.entries(summary?.flags ?? {})
        .filter(([, total]) => Number(total) > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
    [summary]
  );
  const applyDisabledReason = useMemo(() => {
    if (!summary) return null;
    if (summary.conflict > 0) {
      return summary.create + summary.update > 0
        ? "Existem conflitos pendentes. Use 'Aplicar sem conflitos' para seguir apenas com as linhas seguras."
        : "Nenhuma linha ficou pronta para aplicar. Primeiro ajuste os conflitos da planilha.";
    }
    if (summary.error > 0) {
      return "Existem erros na prévia. Corrija as linhas com erro antes de aplicar.";
    }
    if (summary.create + summary.update <= 0) {
      return "Não há alunos novos ou alterações seguras para aplicar nesta prévia.";
    }
    return null;
  }, [summary]);

  const summaryCards = useMemo(
    () =>
      summary
        ? [
            { label: "Criar", value: summary.create },
            { label: "Atualizar", value: summary.update },
            { label: "Conflitos", value: summary.conflict },
            { label: "Ignorar", value: summary.skip },
          ]
        : [],
    [summary]
  );
  const syncStatusMessage = useMemo(() => {
    if (!summary) return null;
    const created = Number(summary.create ?? 0);
    const updated = Number(summary.update ?? 0);
    const conflicts = Number(summary.conflict ?? 0);
    const errors = Number(summary.error ?? 0);
    const skipped = Number(summary.skip ?? 0);

    if (created === 0 && updated === 0 && conflicts === 0 && errors === 0 && skipped > 0) {
      return {
        tone: "success" as const,
        title: "Planilha já sincronizada",
        description:
          "Nenhuma nova inserção/atualização necessária. Reaplicar não apaga e não recria tudo: apenas mantém o estado atual.",
      };
    }

    if (created > 0 || updated > 0) {
      return {
        tone: "info" as const,
        title: "Sincronização incremental",
        description:
          "A aplicação não remove e recria todos os alunos. Ela só cria novos, atualiza faltantes e ignora o que já está igual.",
      };
    }

    return null;
  }, [summary]);

  const intakeSummary = useMemo(() => {
    if (!loadedSheet?.rawRows?.length) return null;
    const intakes = loadedSheet.rawRows
      .map((row) => mapGoogleFormsRowToAthleteIntake(row))
      .filter((item) => item.fullName.trim().length > 0);
    if (!intakes.length) return null;
    return buildAthleteIntakeSummary(intakes);
  }, [loadedSheet]);
  const modalityStats = loadedSheet?.detectedModalities ?? [];
  const volleyballModalities = useMemo(
    () => modalityStats.filter((item) => item.isVolleyball),
    [modalityStats]
  );
  const nonVolleyballModalities = useMemo(
    () => modalityStats.filter((item) => !item.isVolleyball),
    [modalityStats]
  );
  const validClassIds = useMemo(() => new Set(classes.map((item) => item.id)), [classes]);
  const defaultClassId = useMemo(() => {
    if (storedDefaultClassId && validClassIds.has(storedDefaultClassId)) return storedDefaultClassId;
    return null;
  }, [storedDefaultClassId, validClassIds]);
  const unitOptions = useMemo(
    () =>
      Array.from(
        new Set(
          classes
            .map((item) => String(item.unit ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [classes]
  );
  const classOptionsByUnit = useMemo(
    () => classes.filter((item) => !selectedUnit || item.unit === selectedUnit),
    [classes, selectedUnit]
  );
  const modalityClassMap = useMemo(() => {
    const next: ModalityClassMap = {};
    Object.entries(storedModalityClassMap).forEach(([normalized, classId]) => {
      if (classId === null || validClassIds.has(classId)) {
        next[normalized] = classId;
      }
    });
    return next;
  }, [storedModalityClassMap, validClassIds]);
  const classChoices = useMemo(
    () => classes.map((item) => ({ id: item.id, label: getClassLabel(item) })),
    [classes]
  );
  const selectedDefaultClass = useMemo(
    () => classes.find((item) => item.id === defaultClassId) ?? null,
    [classes, defaultClassId]
  );
  const modalityResolvedCount = useMemo(
    () =>
      modalityStats.reduce((total, item) => {
        const classId = getEffectiveModalityClassId(
          item.normalized,
          modalityClassMap,
          selectedUnit ? defaultClassId : null
        );
        return classId ? total + item.count : total;
      }, 0),
    [defaultClassId, modalityClassMap, modalityStats, selectedUnit]
  );
  const unresolvedNonVolleyballCount = useMemo(
    () =>
      nonVolleyballModalities.reduce((total, item) => {
        const classId = getEffectiveModalityClassId(
          item.normalized,
          modalityClassMap,
          selectedUnit ? defaultClassId : null
        );
        return classId ? total : total + item.count;
      }, 0),
    [defaultClassId, modalityClassMap, nonVolleyballModalities, selectedUnit]
  );
  const maleVolleyballDiagnostics = useMemo(() => {
    if (!loadedSheet || !previewResult) return null;

    const rowPlanByNumber = new Map(
      (previewResult.rows ?? []).map((item) => [Number(item.rowNumber), item] as const)
    );

    const totals = {
      total: 0,
      create: 0,
      update: 0,
      skip: 0,
      conflict: 0,
      error: 0,
    };
    const byClass: Record<string, number> = {};

    loadedSheet.rows.forEach((row) => {
      const rowNumber = Number(row.sourceRowNumber ?? 0);
      if (!rowNumber) return;

      const sourceIndex = Math.max(0, rowNumber - 2);
      const rawRow = loadedSheet.rawRows[sourceIndex];
      if (!rawRow) return;

      const intake = mapGoogleFormsRowToAthleteIntake(rawRow);
      const isMale = intake.sex === "masculino";
      const hasVolleyball = intake.modalities.some((item) => normalizeAthleteModality(item) === "voleibol");

      if (!isMale || !hasVolleyball) return;

      totals.total += 1;
      const action = rowPlanByNumber.get(rowNumber)?.action;
      const plannedClassName = rowPlanByNumber.get(rowNumber)?.className;
      if (plannedClassName) {
        byClass[plannedClassName] = Number(byClass[plannedClassName] ?? 0) + 1;
      }
      if (action === "create") totals.create += 1;
      else if (action === "update") totals.update += 1;
      else if (action === "skip") totals.skip += 1;
      else if (action === "conflict") totals.conflict += 1;
      else totals.error += 1;
    });

    const classDistribution = Object.entries(byClass)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, total]) => `${name}: ${total}`)
      .join(" • ");

    const appliedRows = totals.create + totals.update;
    const notAppliedRows = Math.max(0, totals.total - appliedRows);

    return totals.total > 0 ? { ...totals, classDistribution, appliedRows, notAppliedRows } : null;
  }, [loadedSheet, previewResult]);
  const nonAppliedDiagnostics = useMemo(() => {
    if (!loadedSheet || !previewResult) return null;

    const rowPlanByNumber = new Map(
      (previewResult.rows ?? []).map((item) => [Number(item.rowNumber), item] as const)
    );

    const details: Array<{
      rowNumber: number;
      name: string;
      sexLabel: string;
      reason: string;
      action: string;
    }> = [];

    const totals = {
      total: 0,
      masculino: 0,
      feminino: 0,
      outro: 0,
    };

    loadedSheet.rows.forEach((row) => {
      const rowNumber = Number(row.sourceRowNumber ?? 0);
      if (!rowNumber) return;
      const plan = rowPlanByNumber.get(rowNumber);
      if (!plan || plan.action === "create" || plan.action === "update") return;

      const sourceIndex = Math.max(0, rowNumber - 2);
      const rawRow = loadedSheet.rawRows[sourceIndex];
      const intake = rawRow ? mapGoogleFormsRowToAthleteIntake(rawRow) : null;

      const sexLabel =
        intake?.sex === "masculino"
          ? "Masculino"
          : intake?.sex === "feminino"
            ? "Feminino"
            : "Outro/Não informado";

      totals.total += 1;
      if (intake?.sex === "masculino") totals.masculino += 1;
      else if (intake?.sex === "feminino") totals.feminino += 1;
      else totals.outro += 1;

      const primaryFlag = plan.flags?.[0];
      const reason = primaryFlag ? getFlagDetail(primaryFlag).title : (plan.errorMessage || "Sem alteração");

      details.push({
        rowNumber,
        name: row.name ?? intake?.fullName ?? "Sem nome",
        sexLabel,
        reason,
        action: plan.action,
      });
    });

    if (!totals.total) return null;

    return {
      ...totals,
      details: details.slice(0, 10),
    };
  }, [loadedSheet, previewResult]);

  const sheetPreviewRows = useMemo(() => {
    if (!loadedSheet) return [];
    const rowPlanByNumber = new Map(
      (previewResult?.rows ?? []).map((item) => [Number(item.rowNumber), item] as const)
    );
    return loadedSheet.rows.map((row) => {
      const rowNumber = Number(row.sourceRowNumber ?? 0);
      const plan = rowPlanByNumber.get(rowNumber);
      const sourceIndex = Math.max(0, rowNumber - 2);
      const rawRow = loadedSheet.rawRows[sourceIndex];
      const intake = rawRow ? mapGoogleFormsRowToAthleteIntake(rawRow) : null;
      const decision =
        rowDecisions[rowNumber] ?? (intake ? getDefaultRowDecision(intake.modalities) : "anamnesis");
      const sexLabel =
        intake?.sex === "masculino" ? "M" : intake?.sex === "feminino" ? "F" : "?";
      return {
        rowNumber,
        name: row.name ?? intake?.fullName ?? "–",
        sexLabel,
        className: row.className ?? "–",
        action: plan?.action ?? null,
        decision,
      };
    });
  }, [loadedSheet, previewResult, rowDecisions]);

  const rowDecisionCounts = useMemo(() => {
    const counts = { import: 0, anamnesis: 0, ignore: 0 };
    sheetPreviewRows.forEach((item) => {
      counts[item.decision] += 1;
    });
    return counts;
  }, [sheetPreviewRows]);

  const resolveRowDecision = useCallback(
    (rowNumber: number, intakeModalities: string[]) =>
      rowDecisions[rowNumber] ?? getDefaultRowDecision(intakeModalities),
    [rowDecisions]
  );

  useEffect(() => {
    if (!visible) return;
    if (!unitOptions.length) {
      setSelectedUnit("");
      return;
    }
    if (selectedDefaultClass?.unit) {
      setSelectedUnit(selectedDefaultClass.unit);
      return;
    }
    if (!selectedUnit || !unitOptions.includes(selectedUnit)) {
      setSelectedUnit("");
    }
  }, [selectedDefaultClass?.unit, selectedUnit, unitOptions, visible]);

  const handleOpenCreateClass = useCallback(
    (modalityLabel: string) => {
      onClose();
      router.push({
        pathname: "/classes",
        params: {
          tab: "criar",
          prefillName: modalityLabel,
          prefillModality: resolveClassModality(modalityLabel) ?? "fitness",
        },
      });
    },
    [onClose, router]
  );

  const closeSyncDropdowns = useCallback(() => {
    setShowUnitDropdown(false);
    setShowClassDropdown(false);
  }, []);

  const syncSyncDropdownLayouts = useCallback(() => {
    if (!showUnitDropdown && !showClassDropdown) return;
    requestAnimationFrame(() => {
      dropdownContainerRef.current?.measureInWindow((x, y) => {
        setDropdownContainer({ x, y });
      });
      if (showUnitDropdown) {
        unitTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setUnitDropdownLayout({ x, y, width, height });
        });
      }
      if (showClassDropdown) {
        classTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setClassDropdownLayout({ x, y, width, height });
        });
      }
    });
  }, [showClassDropdown, showUnitDropdown]);

  const openUnitDropdown = useCallback(() => {
    setShowClassDropdown(false);
    setShowUnitDropdown((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        requestAnimationFrame(() => {
          dropdownContainerRef.current?.measureInWindow((x, y) => {
            setDropdownContainer({ x, y });
          });
          unitTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setUnitDropdownLayout({ x, y, width, height });
          });
        });
      }
      return nextOpen;
    });
  }, [syncSyncDropdownLayouts]);

  const openClassDropdown = useCallback(() => {
    setShowUnitDropdown(false);
    setShowClassDropdown((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        requestAnimationFrame(() => {
          dropdownContainerRef.current?.measureInWindow((x, y) => {
            setDropdownContainer({ x, y });
          });
          classTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setClassDropdownLayout({ x, y, width, height });
          });
        });
      }
      return nextOpen;
    });
  }, [syncSyncDropdownLayouts]);

  const resetFeedback = useCallback(() => {
    setFlowError(null);
    setApplyResultMessage(null);
    setPreviewResult(null);
    setLoadedSheet(null);
    setRowDecisions({});
    setForceApplyConflictRows([]);
    setNeedsPreviewRefresh(false);
    closeSyncDropdowns();
  }, [closeSyncDropdowns]);

  useEffect(() => {
    setForceApplyConflictRows((current) =>
      current.filter((rowNumber) => validConflictRowNumbers.has(Number(rowNumber)))
    );
  }, [validConflictRowNumbers]);

  const toggleForceApplyConflictRow = useCallback((rowNumber: number) => {
    const normalized = Number(rowNumber);
    if (!Number.isFinite(normalized) || !validConflictRowNumbers.has(normalized)) return;
    setForceApplyConflictRows((current) =>
      current.includes(normalized)
        ? current.filter((value) => value !== normalized)
        : [...current, normalized]
    );
  }, [validConflictRowNumbers]);

  const setRowDecision = useCallback((rowNumber: number, decision: RowDecision) => {
    setRowDecisions((current) => {
      if ((current[rowNumber] ?? null) === decision) return current;
      return { ...current, [rowNumber]: decision };
    });
    if (previewResult) {
      setPreviewResult(null);
      setNeedsPreviewRefresh(true);
    }
  }, [previewResult]);

  const handleSelectUnit = useCallback(
    (unit: string) => {
      if (selectedUnit === unit && selectedDefaultClass?.unit === unit) {
        return;
      }
      setSelectedUnit(unit);
      if (selectedDefaultClass && selectedDefaultClass.unit !== unit) {
        setStoredDefaultClassId(null);
        setPreviewResult(null);
        setNeedsPreviewRefresh(true);
      }
    },
    [selectedDefaultClass, selectedUnit, setStoredDefaultClassId]
  );

  const handleSelectDefaultClass = useCallback(
    (classId: string) => {
      if (classId === defaultClassId) return;
      setStoredDefaultClassId(classId);
      setPreviewResult(null);
      setNeedsPreviewRefresh(true);
    },
    [defaultClassId, setStoredDefaultClassId]
  );

  const buildRowsWithModalityMapping = useCallback(
    (loaded: LoadedGoogleFormsSheet, map: ModalityClassMap) =>
      loaded.rows.map((row) => {
        if (row.classId?.trim()) return row;
        const sourceIndex = Math.max(0, Number(row.sourceRowNumber ?? 2) - 2);
        const rawRow = loaded.rawRows[sourceIndex];
        if (!rawRow) return row;
        const intake = mapGoogleFormsRowToAthleteIntake(rawRow);
        const classId = intake.modalities
          .map((item) => normalizeAthleteModality(item))
          .map((normalized) => {
            const explicitMappingExists = Object.prototype.hasOwnProperty.call(map, normalized);
            const autoAssignable = shouldAutoAssignModality(normalized);
            const mapped = getEffectiveModalityClassId(
              normalized,
              map,
              selectedUnit ? defaultClassId : null
            );
            if (mapped) return mapped;
            if (explicitMappingExists) return null;
            if (!autoAssignable) return null;
            return resolveAutoClassByUnitModality(normalized, selectedUnit, classes);
          })
          .find((value): value is string => Boolean(value));
        if (!classId) return row;
        const resolvedClassId = resolveGenderAwareClassId(classId, intake.sex, classes);
        const targetClass = classes.find((item) => item.id === resolvedClassId);
        return {
          ...row,
          classId: resolvedClassId,
          className: targetClass?.name ?? row.className,
          unit: targetClass?.unit ?? row.unit,
        };
      }),
    [classes, defaultClassId, selectedUnit]
  );

  const updateModalityMapping = useCallback((normalized: string, classId: string | null) => {
    if ((modalityClassMap[normalized] ?? null) === classId) return;
    setStoredModalityClassMap((current) => ({
      ...current,
      [normalized]: classId,
    }));
    setPreviewResult(null);
    setNeedsPreviewRefresh(true);
  }, [modalityClassMap, setStoredModalityClassMap]);

  const handlePreview = useCallback(async () => {
    if (!organizationId) {
      Alert.alert("Sincronizar Forms", "Selecione uma organização ativa.");
      return;
    }
    if (!storedModalityClassMapLoaded || !storedDefaultClassIdLoaded) {
      Alert.alert("Sincronizar Forms", "Aguarde carregar os mapeamentos salvos desta organização.");
      return;
    }
    try {
      setFlowError(null);
      setApplyResultMessage(null);
      setLoadingMessage("Lendo planilha do Google Sheets...");
      const loaded = await loadGoogleFormsSheetImport(sheetUrl, classes);
      setLoadedSheet(loaded);
      const nextRowDecisions: Record<number, RowDecision> = { ...rowDecisions };
      loaded.rows.forEach((row, index) => {
        const rowNumber = Number(row.sourceRowNumber ?? index + 2);
        if (!Number.isFinite(rowNumber) || rowNumber <= 0) return;
        if (nextRowDecisions[rowNumber] !== undefined) return;
        const sourceIndex = Math.max(0, rowNumber - 2);
        const rawRow = loaded.rawRows[sourceIndex];
        const intake = rawRow ? mapGoogleFormsRowToAthleteIntake(rawRow) : null;
        nextRowDecisions[rowNumber] = getDefaultRowDecision(intake?.modalities ?? []);
      });
      setRowDecisions(nextRowDecisions);
      const nextModalityMap: ModalityClassMap = { ...modalityClassMap };
      loaded.detectedModalities.forEach((item) => {
        if (nextModalityMap[item.normalized] !== undefined) return;
        if (item.isVolleyball && selectedUnit && defaultClassId) {
          nextModalityMap[item.normalized] = defaultClassId;
        }
      });
      setStoredModalityClassMap(nextModalityMap);
      setLoadingMessage("Gerando prévia da sincronização...");
      const mappedRows = buildRowsWithModalityMapping(loaded, nextModalityMap).filter((row) => {
        const rowNumber = Number(row.sourceRowNumber ?? 0);
        const sourceIndex = Math.max(0, rowNumber - 2);
        const rawRow = loaded.rawRows[sourceIndex];
        const intake = rawRow ? mapGoogleFormsRowToAthleteIntake(rawRow) : null;
        return (nextRowDecisions[rowNumber] ?? getDefaultRowDecision(intake?.modalities ?? [])) === "import";
      });
      const preview = await previewStudentsSync({
        organizationId,
        policy: "misto",
        sourceFilename: loaded.sourceFilename,
        rows: mappedRows,
        accessToken: session?.access_token ?? null,
      });
      setPreviewResult(preview);
      setNeedsPreviewRefresh(false);
      setLoadingMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar planilha.";
      setFlowError(message);
      setLoadingMessage(null);
      setPreviewResult(null);
      setLoadedSheet(null);
    }
  }, [
    buildRowsWithModalityMapping,
    classes,
    defaultClassId,
    modalityClassMap,
    organizationId,
    session?.access_token,
    selectedUnit,
    storedDefaultClassIdLoaded,
    rowDecisions,
    setStoredModalityClassMap,
    sheetUrl,
    storedModalityClassMapLoaded,
  ]);

  const handleApply = useCallback(() => {
    if (!organizationId || !loadedSheet || !previewResult) {
      setFlowError("Não foi possível iniciar a aplicação. Gere a prévia novamente.");
      return;
    }
    setApplyConfirmState({
      mode: "all",
      title: "Confirmar aplicação",
      message: `Você vai importar ${rowDecisionCounts.import} linha(s), manter ${rowDecisionCounts.anamnesis} apenas na anamnese e ignorar ${rowDecisionCounts.ignore}.`,
      confirmLabel: `Aplicar ${rowDecisionCounts.import} linhas`,
    });
  }, [loadedSheet, organizationId, previewResult, rowDecisionCounts]);

  const handleApplySkippingConflicts = useCallback(() => {
    if (!organizationId || !loadedSheet || !previewResult) {
      setFlowError("Não foi possível iniciar a aplicação. Gere a prévia novamente.");
      return;
    }
    if (effectiveSafeRowsCount <= 0) {
      setApplyConfirmState({
        mode: null,
        title: "Aplicar sem conflitos",
        message: "Não há linhas seguras para aplicar agora. Resolva os conflitos ou ajuste o mapeamento e gere nova prévia.",
        confirmLabel: "OK",
      });
      return;
    }
    setApplyConfirmState({
      mode: "safe",
      title: "Confirmar aplicação segura",
      message: selectedForceApplyRows.length > 0
        ? `Serão aplicadas ${effectiveSafeRowsCount} linhas (${safeRowsCount} seguras + ${selectedForceApplyRows.length} conflito(s) marcados como 'adicionar mesmo assim').`
        : `Serão aplicadas ${safeRowsCount} linhas seguras. ${summary?.conflict ?? 0} conflito(s) serão ignorados.`,
      confirmLabel: `Aplicar ${effectiveSafeRowsCount} linhas`,
    });
  }, [
    loadedSheet,
    organizationId,
    previewResult,
    effectiveSafeRowsCount,
    safeRowsCount,
    selectedForceApplyRows.length,
    summary?.conflict,
    rowDecisionCounts,
  ]);

  const executeApply = useCallback(async (mode: "all" | "safe") => {
    if (!organizationId || !loadedSheet || !previewResult) {
      setFlowError("Não foi possível aplicar. Gere a prévia novamente.");
      return;
    }

    const conflictRowsFromPreview = (previewResult.rows ?? []).filter((row) => row.action === "conflict");
    const forcedOverwriteRows = new Set(selectedForceApplyRows.map((rowNumber) => String(rowNumber)));
    const safeResolutions = Object.fromEntries(
      conflictRowsFromPreview.map((row) => [
        String(row.rowNumber),
        forcedOverwriteRows.has(String(row.rowNumber)) ? "OVERWRITE" as const : "SKIP" as const,
      ])
    );
    const resolutions =
      mode === "safe"
        ? safeResolutions
        : selectedForceApplyRows.length
          ? Object.fromEntries(selectedForceApplyRows.map((rowNumber) => [String(rowNumber), "OVERWRITE" as const]))
          : undefined;
    const resolvedRunId = String(previewResult.runId ?? "").trim();
    const nextModalityMap: ModalityClassMap = { ...modalityClassMap };
    loadedSheet.detectedModalities.forEach((item) => {
      if (nextModalityMap[item.normalized] !== undefined) return;
      if (item.isVolleyball && selectedUnit && defaultClassId) {
        nextModalityMap[item.normalized] = defaultClassId;
      }
    });

    const mappedRows = buildRowsWithModalityMapping(loadedSheet, nextModalityMap).filter((row) => {
      const rowNumber = Number(row.sourceRowNumber ?? 0);
      const sourceIndex = Math.max(0, rowNumber - 2);
      const rawRow = loadedSheet.rawRows[sourceIndex];
      const intake = rawRow ? mapGoogleFormsRowToAthleteIntake(rawRow) : null;
      return resolveRowDecision(rowNumber, intake?.modalities ?? []) === "import";
    });
    const intakeRows = loadedSheet.rawRows.filter((_, index) => {
      const rowNumber = index + 2;
      const rawRow = loadedSheet.rawRows[index];
      const intake = rawRow ? mapGoogleFormsRowToAthleteIntake(rawRow) : null;
      return resolveRowDecision(rowNumber, intake?.modalities ?? []) !== "ignore";
    });
    const totalRows = Number(previewResult.summary?.totalRows ?? mappedRows.length ?? 0);
    const targetRows = Math.max(0, mode === "safe" ? effectiveSafeRowsCount : totalRows);

    setApplyLoading(true);
    setApplyResultMessage(null);
    setApplyProgress({
      processed: 0,
      total: targetRows,
      label: "Preparando aplicação...",
      detail: `0/${targetRows || 0} alunos`,
    });

    try {
      setApplyProgress({
        processed: 0,
        total: targetRows,
        label: mode === "safe" ? "Aplicando linhas seguras..." : "Aplicando sincronização de alunos...",
        detail: `0/${targetRows || 0} alunos`,
      });

      const result = await applyStudentsSync({
        organizationId,
        policy: "misto",
        sourceFilename: loadedSheet.sourceFilename,
        runId: resolvedRunId || undefined,
        rows: mappedRows,
        resolutions,
        accessToken: session?.access_token ?? null,
      });

      const insertedRows = Number(result.summary.create + result.summary.update);
      setApplyProgress({
        processed: insertedRows,
        total: targetRows || insertedRows,
        label: "Alunos processados",
        detail: `C:${result.summary.create} U:${result.summary.update} S:${result.summary.skip} E:${result.summary.error}`,
      });

      setApplyProgress({
        processed: insertedRows,
        total: targetRows || insertedRows,
        label: "Sincronizando anamnese...",
        detail: `${insertedRows}/${targetRows || insertedRows} alunos inseridos/atualizados`,
      });

      const intakeResult = await syncGoogleFormsAthleteIntakes({
        organizationId,
        rawRows: intakeRows,
        classes,
        modalityClassMap,
      });

      setApplyProgress({
        processed: insertedRows,
        total: targetRows || insertedRows,
        label: "Finalizando",
        detail: `Anamneses C:${intakeResult.created} U:${intakeResult.updated}`,
      });

      const createdRows = Number(result.summary.create ?? 0);
      const updatedRows = Number(result.summary.update ?? 0);
      const skipRows = Number(result.summary.skip ?? 0);
      const errorRows = Number(result.summary.error ?? 0);
      const processedRows = Number(result.summary.totalRows ?? createdRows + updatedRows + skipRows + errorRows);
      const additionHint =
        createdRows > 0
          ? `${createdRows} aluno(s) novo(s) foram adicionados nesta execução.`
          : "Nenhum aluno novo foi adicionado nesta execução.";

      let applyErrorHint = "";
      const resultErrorRows = (result.rows ?? [])
        .filter((row) => row.action === "error")
        .map((row) => ({
          rowNumber: Number(row.rowNumber ?? 0),
          errorMessage: row.errorMessage ?? null,
          flags: row.flags ?? [],
        }));
      if (errorRows > 0 && resultErrorRows.length > 0) {
        applyErrorHint = buildApplyErrorHint(resultErrorRows);
      }

      const applyRunId = String(result.runId ?? resolvedRunId ?? "").trim();
      if (!applyErrorHint && errorRows > 0 && applyRunId) {
        try {
          const logs = await listStudentsSyncRunLogs(applyRunId, 200, 0);
          const errorLogRows = logs
            .filter((row) => row.action === "error")
            .map((row) => ({
              rowNumber: Number(row.rowNumber ?? 0),
              errorMessage: row.errorMessage ?? null,
              flags: row.flags ?? [],
            }));
          applyErrorHint = buildApplyErrorHint(errorLogRows);
        } catch {
          applyErrorHint = "";
        }
      }

      setApplyResultMessage(
        `Total processado: ${processedRows}. Novos: ${createdRows}. Atualizados: ${updatedRows}. Sem alterações: ${skipRows}. Erros: ${errorRows}. ${additionHint}${applyErrorHint} Anamneses C:${intakeResult.created} U:${intakeResult.updated}.`
      );
      onImportApplied?.();
      setPreviewResult(null);
      setLoadedSheet(null);
      setNeedsPreviewRefresh(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao aplicar sincronização.";
      setFlowError(message);
    } finally {
      setApplyLoading(false);
      setApplyProgress(null);
    }
  }, [
    buildRowsWithModalityMapping,
    classes,
    defaultClassId,
    loadedSheet,
    modalityClassMap,
    onImportApplied,
    organizationId,
    previewResult,
    effectiveSafeRowsCount,
    safeRowsCount,
    selectedForceApplyRows,
    selectedUnit,
    session?.access_token,
    resolveRowDecision,
  ]);

  const requestCloseWhileApplying = useCallback(async () => {
    if (applyLoading || applyConfirmLoading) {
      const shouldClose = await confirmDialog({
        title: "Cancelar sincronização?",
        message:
          "A sincronização já foi iniciada. Fechar agora pode encerrar esta tela, mas a operação pode continuar no servidor. Deseja continuar acompanhando ou cancelar a sincronização?",
        confirmLabel: "Cancelar sincronização",
        cancelLabel: "Continuar",
        tone: "danger",
        onConfirm: async () => {},
      });
      if (!shouldClose) return;
      setApplyConfirmState(null);
      onClose();
      return;
    }
    setApplyConfirmState(null);
    onClose();
  }, [applyConfirmLoading, applyLoading, confirmDialog, onClose]);

  const handleConfirmApply = useCallback(async () => {
    if (!applyConfirmState) return;
    if (!applyConfirmState.mode) {
      setApplyConfirmState(null);
      return;
    }
    setApplyConfirmLoading(true);
    await executeApply(applyConfirmState.mode);
    setApplyConfirmLoading(false);
    setApplyConfirmState(null);
  }, [applyConfirmState, executeApply]);

  const handleCloseApplyConfirm = useCallback(async () => {
    if (applyLoading || applyConfirmLoading) {
      const shouldClose = await confirmDialog({
        title: "Cancelar sincronização?",
        message:
          "A sincronização já foi iniciada. Fechar agora pode encerrar esta tela, mas a operação pode continuar no servidor. Deseja continuar acompanhando ou cancelar a sincronização?",
        confirmLabel: "Cancelar sincronização",
        cancelLabel: "Continuar",
        tone: "danger",
        onConfirm: async () => {},
      });
      if (!shouldClose) return;
      setApplyConfirmState(null);
      onClose();
      return;
    }
    setApplyConfirmState(null);
  }, [applyConfirmLoading, applyLoading, confirmDialog, onClose]);

  const applyButtonLabel = applyLoading ? "Aplicando..." : "Aplicar sincronização";
  const safeApplyButtonLabel = applyLoading
    ? "Aplicando..."
    : `Aplicar sem conflitos (${effectiveSafeRowsCount})`;

  return (
      <>
      <ModalSheet visible={visible} onClose={requestCloseWhileApplying} cardStyle={cardStyle} position="center">
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
            Sincronizar Forms
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Link da planilha, turma padrão e sincronização.
          </Text>
        </View>
        <Pressable
          onPress={requestCloseWhileApplying}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ marginTop: 12, flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          onScrollBeginDrag={closeSyncDropdowns}
          onMomentumScrollBegin={closeSyncDropdowns}
          contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
        >
          <View
            ref={dropdownContainerRef}
            collapsable={false}
            onLayout={syncSyncDropdownLayouts}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
              padding: 12,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
              Link da planilha
            </Text>
            <TextInput
              value={sheetUrl}
              onChangeText={(value) => {
                setSheetUrl(value);
                resetFeedback();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              placeholderTextColor={colors.muted}
              style={{
                minHeight: 96,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.card,
                color: colors.text,
                paddingHorizontal: 12,
                paddingVertical: 10,
                textAlignVertical: "top",
              }}
              multiline
            />
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Aceita link do Google Sheets ou apenas o ID.
            </Text>
            <Button
              label={loadingMessage ? loadingMessage : "Gerar prévia da sincronização"}
              variant="outline"
              onPress={() => {
                closeSyncDropdowns();
                void handlePreview();
              }}
              loading={Boolean(loadingMessage)}
            />
          </View>

          {flowError ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.dangerSolidBg,
                borderRadius: 12,
                backgroundColor: colors.dangerBg,
                padding: 10,
                gap: 4,
              }}
            >
              <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>
                Falha ao ler planilha
              </Text>
              <Text style={{ color: colors.dangerText, fontSize: 12 }}>{flowError}</Text>
            </View>
          ) : null}

          {applyResultMessage ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.successBg,
                borderRadius: 12,
                backgroundColor: colors.background,
                padding: 10,
                gap: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                Sincronização concluída
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{applyResultMessage}</Text>
            </View>
          ) : null}

          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
              padding: 12,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>Vínculo padrão</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Escolha uma Unidade. Para vôlei, a distribuição pode ser automática por modalidade e sexo. As demais modalidades ficam para escolha explícita.
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Unidade</Text>
                <View ref={unitTriggerRef} collapsable={false}>
                  <Pressable
                    onPress={openUnitDropdown}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.card,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                      {selectedUnit || "Todas as unidades"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{ transform: [{ rotate: showUnitDropdown ? "180deg" : "0deg" }] }}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Turma</Text>
                <View ref={classTriggerRef} collapsable={false}>
                  <Pressable
                    onPress={openClassDropdown}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.card,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700", flex: 1 }} numberOfLines={2}>
                      {defaultClassId === null
                        ? "Automática (sem turma fixa)"
                        : selectedDefaultClass
                          ? getClassLabel(selectedDefaultClass)
                          : "Selecione uma turma"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{ transform: [{ rotate: showClassDropdown ? "180deg" : "0deg" }] }}
                    />
                  </Pressable>
                </View>
              </View>
            </View>

            {selectedDefaultClass ? (
              <View style={{ gap: 3 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Padrão ativo: {getClassLabel(selectedDefaultClass)}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Se a resposta tiver sexo, o sistema tenta direcionar automaticamente para a turma masculina/feminina correspondente na mesma unidade.
                </Text>
              </View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Sem turma fixa: o sistema usa distribuição automática por unidade, modalidade e sexo apenas para vôlei.
              </Text>
            )}

            {nonVolleyballModalities.length ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  onPress={() => {
                    closeSyncDropdowns();
                    setShowOtherModalities((prev) => !prev);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    Outras modalidades ({nonVolleyballModalities.length})
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: showOtherModalities ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
                {showOtherModalities ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 10, gap: 8 }}>
                    {nonVolleyballModalities.map((item) => {
                      const selectedClassId = getEffectiveModalityClassId(item.normalized, modalityClassMap, defaultClassId);
                      const usingAnamnesisOnly = selectedClassId === null;
                      return (
                        <View key={item.normalized} style={{ gap: 6 }}>
                          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                            {item.label} • {item.count}
                          </Text>
                          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                            <Button
                              label="Usar turma padrão"
                              variant={usingAnamnesisOnly ? "outline" : "secondary"}
                              onPress={() => updateModalityMapping(item.normalized, defaultClassId)}
                              disabled={!defaultClassId}
                            />
                            <Button
                              label="Anamnese"
                              variant={usingAnamnesisOnly ? "secondary" : "outline"}
                              onPress={() => updateModalityMapping(item.normalized, null)}
                            />
                            <Button
                              label="Criar turma"
                              variant="ghost"
                              onPress={() => handleOpenCreateClass(item.label)}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Turmas por modalidade: {modalityResolvedCount} • Sem turma: {unresolvedNonVolleyballCount}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Linhas: importar {rowDecisionCounts.import} • anamnese {rowDecisionCounts.anamnesis} • ignorar {rowDecisionCounts.ignore}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Padrão: vôlei entra na turma; outras modalidades ficam em anamnese.
            </Text>
            {intakeSummary ? (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Anamneses: {intakeSummary.total} • Atenção/Revisar: {intakeSummary.needsIndividualAttention}
              </Text>
            ) : null}
          </View>

          {loadedSheet ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
                overflow: "hidden",
              }}
            >
              <Pressable
                onPress={() => {
                  closeSyncDropdowns();
                  setShowSheetPreview((prev) => !prev);
                }}
                style={{
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <View style={{ gap: 2, flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                    Planilha conectada
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {loadedSheet.rows.length} linhas • ID: {compactSheetId(loadedSheet.sheetId)}
                  </Text>
                </View>
                <Ionicons
                  name={showSheetPreview ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
              {showSheetPreview ? (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      paddingHorizontal: 12,
                      paddingTop: 10,
                      paddingBottom: 8,
                    }}
                  >
                    {[
                      { label: "Importar", color: colors.successText ?? "#2e7d32" },
                      { label: "Anamnese", color: colors.infoText ?? "#1565c0" },
                      { label: "Ignorar", color: colors.muted },
                    ].map((item) => (
                      <View
                        key={item.label}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 999,
                          backgroundColor: colors.background,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ color: item.color, fontSize: 10, fontWeight: "700" }}>
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: colors.card,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 10, width: 32, fontWeight: "700" }}>#</Text>
                    <Text style={{ color: colors.muted, fontSize: 10, flex: 1, fontWeight: "700" }}>Nome</Text>
                    <Text style={{ color: colors.muted, fontSize: 10, width: 18, textAlign: "center", fontWeight: "700" }}>Sx</Text>
                    <Text style={{ color: colors.muted, fontSize: 10, width: 90, textAlign: "right", fontWeight: "700" }}>Turma</Text>
                    {previewResult ? (
                      <Text style={{ color: colors.muted, fontSize: 10, width: 58, textAlign: "right", fontWeight: "700" }}>Status</Text>
                    ) : null}
                  </View>
                  {(showAllPreviewRows ? sheetPreviewRows : sheetPreviewRows.slice(0, 30)).map((item) => {
                    const actionStyle: { label: string; color: string } =
                      item.action === "create"
                        ? { label: "Novo", color: colors.successText ?? "#2e7d32" }
                        : item.action === "update"
                          ? { label: "Atualizar", color: colors.primaryText ?? "#1565c0" }
                          : item.action === "conflict"
                            ? { label: "Conflito", color: colors.warningText ?? "#e65100" }
                        : item.action === "error"
                              ? { label: "Erro", color: colors.dangerText ?? "#b71c1c" }
                          : { label: "Já existe", color: colors.muted };
                    return (
                      <View
                        key={item.rowNumber}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                          gap: 6,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={{ color: colors.muted, fontSize: 11, width: 32 }}>L{item.rowNumber}</Text>
                          <Text style={{ color: colors.text, fontSize: 12, flex: 1 }} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11, width: 18, textAlign: "center" }}>
                            {item.sexLabel}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11, width: 90, textAlign: "right" }} numberOfLines={1}>
                            {item.className}
                          </Text>
                          {previewResult ? (
                            <Text
                              style={{
                                fontSize: 10,
                                width: 58,
                                textAlign: "right",
                                fontWeight: "700",
                                color: actionStyle.color,
                              }}
                              numberOfLines={1}
                            >
                              {actionStyle.label}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {([
                            { key: "import", label: "Importar" },
                            { key: "anamnesis", label: "Anamnese" },
                            { key: "ignore", label: "Ignorar" },
                          ] as const).map((option) => {
                            const active = item.decision === option.key;
                            return (
                              <Pressable
                                key={option.key}
                                onPress={() => setRowDecision(item.rowNumber, option.key)}
                                style={{
                                  borderWidth: 1,
                                  borderColor: active ? colors.primaryBg : colors.border,
                                  backgroundColor: active ? colors.secondaryBg : colors.background,
                                  borderRadius: 999,
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                }}
                              >
                                <Text style={{ color: active ? colors.text : colors.muted, fontSize: 10, fontWeight: "700" }}>
                                  {option.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                  {sheetPreviewRows.length > 30 ? (
                    <Pressable
                      onPress={() => setShowAllPreviewRows((prev) => !prev)}
                      style={{ padding: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: colors.primaryText ?? colors.text, fontSize: 12, fontWeight: "700" }}>
                        {showAllPreviewRows
                          ? "Ver menos"
                          : `Ver todos (${sheetPreviewRows.length})`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {loadedSheet && !summary ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.infoBg,
                borderRadius: 12,
                backgroundColor: colors.infoBg,
                padding: 10,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.infoText, fontWeight: "800", fontSize: 12 }}>
                {needsPreviewRefresh ? "Vínculo alterado" : "Prévia pendente"}
              </Text>
              <Text style={{ color: colors.infoText, fontSize: 11 }}>
                {needsPreviewRefresh
                  ? "Você mudou Unidade/Turma ou modalidades. Gere a prévia novamente para habilitar a aplicação."
                  : "Gere a prévia para validar os dados antes de aplicar a sincronização."}
              </Text>
            </View>
          ) : null}

          {summary ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                Prévia da sincronização
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {summaryCards.map((item) => (
                  <View
                    key={item.label}
                    style={{
                      minWidth: 92,
                      flexGrow: 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                      gap: 2,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{item.label}</Text>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Total de respostas processadas: {summary.totalRows}
              </Text>
              <Pressable
                onPress={() => {
                  closeSyncDropdowns();
                  setShowSyncDetails((prev) => !prev);
                }}
                style={{
                  alignSelf: "flex-start",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 999,
                  backgroundColor: colors.background,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
                  {showSyncDetails ? "Ocultar detalhes" : "Ver detalhes"}
                </Text>
              </Pressable>
              <View style={{ display: showSyncDetails ? "flex" : "none", gap: 10 }}>
              {syncStatusMessage ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: syncStatusMessage.tone === "success" ? colors.successBg : colors.infoBg,
                    borderRadius: 10,
                    backgroundColor: syncStatusMessage.tone === "success" ? colors.card : colors.infoBg,
                    padding: 9,
                    gap: 3,
                  }}
                >
                  <Text
                    style={{
                      color: syncStatusMessage.tone === "success" ? colors.text : colors.infoText,
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    {syncStatusMessage.title}
                  </Text>
                  <Text
                    style={{
                      color: syncStatusMessage.tone === "success" ? colors.muted : colors.infoText,
                      fontSize: 11,
                    }}
                  >
                    {syncStatusMessage.description}
                  </Text>
                </View>
              ) : null}
              {maleVolleyballDiagnostics ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    backgroundColor: colors.card,
                    padding: 9,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                    Vôlei Masculino (diagnóstico)
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Forms: {maleVolleyballDiagnostics.total} • Novos: {maleVolleyballDiagnostics.create} • Atualizados: {maleVolleyballDiagnostics.update}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Sem alteração: {maleVolleyballDiagnostics.skip} • Conflitos: {maleVolleyballDiagnostics.conflict} • Erros: {maleVolleyballDiagnostics.error}
                  </Text>
                  {maleVolleyballDiagnostics.notAppliedRows > 0 ? (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: colors.warningBg,
                        borderRadius: 8,
                        backgroundColor: colors.warningBg,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: colors.warningText, fontWeight: "800", fontSize: 11 }}>
                        Atenção: {maleVolleyballDiagnostics.notAppliedRows} de {maleVolleyballDiagnostics.total} do Vôlei Masculino não geraram criação ou atualização nesta prévia.
                      </Text>
                      <Text style={{ color: colors.warningText, fontSize: 11 }}>
                        Na maior parte dos casos, isso significa que o aluno já existe no cadastro e não precisou de mudança, ou ficou em revisão manual.
                      </Text>
                    </View>
                  ) : null}
                  {maleVolleyballDiagnostics.classDistribution ? (
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      Turmas alvo: {maleVolleyballDiagnostics.classDistribution}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {nonAppliedDiagnostics ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.warningBg,
                    borderRadius: 10,
                    backgroundColor: colors.warningBg,
                    padding: 9,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.warningText, fontWeight: "800", fontSize: 12 }}>
                    Sem ação: {nonAppliedDiagnostics.total}
                  </Text>
                  <Text style={{ color: colors.warningText, fontSize: 11 }}>
                    Isso inclui principalmente cadastros que já estavam sincronizados e linhas que pedem revisão.
                  </Text>
                  <Text style={{ color: colors.warningText, fontSize: 11 }}>
                    Masculino: {nonAppliedDiagnostics.masculino} • Feminino: {nonAppliedDiagnostics.feminino} • Outro/Não informado: {nonAppliedDiagnostics.outro}
                  </Text>
                  {nonAppliedDiagnostics.details.map((item) => (
                    <Text key={`${item.rowNumber}-${item.name}`} style={{ color: colors.warningText, fontSize: 11 }}>
                      • Linha {item.rowNumber} • {item.sexLabel} • {item.name}: {item.reason}
                    </Text>
                  ))}
                </View>
              ) : null}
              {summary.conflict > 0 ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.warningBg,
                    borderRadius: 10,
                    backgroundColor: colors.warningBg,
                    padding: 9,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.warningText, fontWeight: "800", fontSize: 12 }}>
                    Conflitos reais: {summary.conflict}
                  </Text>
                  <Text style={{ color: colors.warningText, fontSize: 11 }}>
                    Principais sinais:
                  </Text>
                  {topConflictFlags.map(([flag, total]) => {
                    const detail = getFlagDetail(flag);
                    return (
                      <Text key={flag} style={{ color: colors.warningText, fontSize: 11 }}>
                        • {detail.title} ({total})
                      </Text>
                    );
                  })}
                </View>
              ) : null}
              {applyDisabledReason ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.infoBg,
                    borderRadius: 10,
                    backgroundColor: colors.infoBg,
                    padding: 9,
                    gap: 3,
                  }}
                >
                  <Text style={{ color: colors.infoText, fontWeight: "800", fontSize: 12 }}>
                    Aplicação bloqueada
                  </Text>
                  <Text style={{ color: colors.infoText, fontSize: 11 }}>{applyDisabledReason}</Text>
                </View>
              ) : null}
              </View>
              {canApply ? (
                <Button
                  label={applyButtonLabel}
                  variant="success"
                  onPress={handleApply}
                  loading={applyLoading}
                />
              ) : null}
              {summary.conflict > 0 ? (
                <Button
                  label={safeApplyButtonLabel}
                  variant="secondary"
                  onPress={handleApplySkippingConflicts}
                  loading={applyLoading}
                  disabled={applyLoading}
                />
              ) : null}
            </View>
          ) : null}

          {conflictRows.length ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                Conflitos para revisar ({conflictRows.length})
              </Text>
              {conflictRows.slice(0, 8).map((row) => (
                (() => {
                  const primaryFlag = row.flags?.[0] ?? "ROW_ERROR";
                  const detail = getFlagDetail(primaryFlag);
                  const rawClassName =
                    readConflictValue(row.conflicts?.classId) ||
                    readConflictValue(row.conflicts?.classid) ||
                    row.className ||
                    null;
                  const incomingName = readConflictValue(row.conflicts?.name, "incoming");
                  const existingName = readConflictValue(row.conflicts?.name, "existing");
                  const secondaryMessage =
                    primaryFlag === "CLASS_NOT_FOUND" && rawClassName
                      ? `Turma informada na planilha: ${rawClassName}. Revise o nome da turma ou o cadastro das turmas na organização.`
                      : primaryFlag === "NAME_CONFLICT" && (incomingName || existingName)
                        ? `Planilha: ${incomingName || "sem nome"}. Cadastro atual: ${existingName || "sem nome"}. Revise se realmente e a mesma pessoa antes de aplicar.`
                      : row.errorMessage || detail.hint;

                  return (
                    <View
                      key={`${row.rowNumber}-${row.action}-${row.flags?.join("-") ?? "none"}`}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        backgroundColor: colors.card,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        gap: 3,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                        Linha {row.rowNumber} • {detail.title}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{secondaryMessage}</Text>
                      {row.action === "conflict" ? (
                        <Pressable
                          onPress={() => toggleForceApplyConflictRow(Number(row.rowNumber))}
                          style={{
                            alignSelf: "flex-start",
                            borderWidth: 1,
                            borderColor: selectedForceApplyRows.includes(Number(row.rowNumber)) ? colors.primaryBg : colors.border,
                            backgroundColor: selectedForceApplyRows.includes(Number(row.rowNumber)) ? colors.secondaryBg : colors.background,
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={{
                              color: selectedForceApplyRows.includes(Number(row.rowNumber)) ? colors.text : colors.muted,
                              fontSize: 10,
                              fontWeight: "700",
                            }}
                          >
                            {selectedForceApplyRows.includes(Number(row.rowNumber)) ? "Marcado para adicionar" : "Adicionar mesmo assim"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })()
              ))}
              {conflictRows.length > 8 ? (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Mostrando 8 de {conflictRows.length} conflitos.
                </Text>
              ) : null}
            </View>
          ) : null}

        </ScrollView>

        <AnchoredDropdown
          visible={showUnitDropdownContent}
          layout={unitDropdownLayout}
          container={dropdownContainer}
          animationStyle={unitDropdownAnimationStyle}
          interactiveRefs={[unitTriggerRef]}
          zIndex={1200}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeSyncDropdowns}
        >
          <AnchoredDropdownOption
            active={!selectedUnit}
            onPress={() => {
              handleSelectUnit("");
              closeSyncDropdowns();
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Todas as unidades</Text>
          </AnchoredDropdownOption>
          {unitOptions.map((unit) => {
            const selected = selectedUnit === unit;
            return (
              <AnchoredDropdownOption
                key={unit}
                active={selected}
                onPress={() => {
                  handleSelectUnit(unit);
                  closeSyncDropdowns();
                }}
              >
                <Text style={{ color: selected ? colors.primaryText : colors.text, fontSize: 12, fontWeight: "700" }}>
                  {unit}
                </Text>
              </AnchoredDropdownOption>
            );
          })}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showClassDropdownContent}
          layout={classDropdownLayout}
          container={dropdownContainer}
          animationStyle={classDropdownAnimationStyle}
          interactiveRefs={[classTriggerRef]}
          zIndex={1200}
          maxHeight={240}
          nestedScrollEnabled
          onRequestClose={closeSyncDropdowns}
        >
          <AnchoredDropdownOption
            active={defaultClassId === null}
            onPress={() => {
              if (defaultClassId !== null) {
                setStoredDefaultClassId(null);
                setPreviewResult(null);
                setNeedsPreviewRefresh(true);
              }
              closeSyncDropdowns();
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
              Automática (sem turma fixa)
            </Text>
          </AnchoredDropdownOption>
          {classOptionsByUnit.length ? (
            classOptionsByUnit.map((item) => {
              const selected = defaultClassId === item.id;
              return (
                <AnchoredDropdownOption
                  key={item.id}
                  active={selected}
                  onPress={() => {
                    handleSelectDefaultClass(item.id);
                    closeSyncDropdowns();
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700", flex: 1 }} numberOfLines={2}>
                      {getClassLabel(item)}
                    </Text>
                    {selected ? <Ionicons name="checkmark-circle" size={16} color={colors.primaryBg} /> : null}
                  </View>
                </AnchoredDropdownOption>
              );
            })
          ) : (
            <View style={{ padding: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {selectedUnit ? "Nenhuma turma cadastrada para esta unidade." : "Selecione uma unidade."}
              </Text>
            </View>
          )}
        </AnchoredDropdown>
      </View>
      </ModalSheet>

      {applyConfirmState ? (
        <ModalSheet
          visible
          onClose={handleCloseApplyConfirm}
          position="center"
          overlayZIndex={31000}
          backdropOpacity={0.72}
          cardStyle={{
            width: "100%",
            maxWidth: 440,
            borderRadius: 18,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 14,
          }}
        >
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              {applyConfirmState.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {applyConfirmState.message}
            </Text>
            {applyProgress && (applyLoading || applyConfirmLoading) ? (
              <View
                style={{
                  marginTop: 6,
                  borderWidth: 1,
                  borderColor: colors.infoBg,
                  borderRadius: 12,
                  backgroundColor: colors.infoBg,
                  padding: 10,
                  gap: 3,
                }}
              >
                <Text style={{ color: colors.infoText, fontSize: 12, fontWeight: "800" }}>
                  {applyProgress.label}
                </Text>
                {applyProgress.detail ? (
                  <Text style={{ color: colors.infoText, fontSize: 11 }}>
                    {applyProgress.detail}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <View style={{ minWidth: 110 }}>
              <Button
                label={applyLoading || applyConfirmLoading ? "Aguarde" : "Fechar"}
                variant="outline"
                onPress={handleCloseApplyConfirm}
                disabled={false}
              />
            </View>
            <View style={{ minWidth: 150 }}>
              <Button
                label={applyLoading || applyConfirmLoading ? "Aplicando..." : applyConfirmState.confirmLabel}
                variant="primary"
                onPress={() => void handleConfirmApply()}
                loading={applyLoading || applyConfirmLoading}
              />
            </View>
          </View>
        </ModalSheet>
      ) : null}

      </>

  );
}
