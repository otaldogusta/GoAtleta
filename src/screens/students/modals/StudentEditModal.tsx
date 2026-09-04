import {
    type NamedExoticComponent,
    type RefObject,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    StyleProp,
    Text,
    TextInput,
    View,
    ViewStyle,
} from "react-native";
import type {
    ClassGroup,
    Student,
    StudentOperationalEvent,
} from "../../../core/models";
import { deriveStudentHealthAssessment } from "../../../core/student-health";
import { normalizeRaDigits } from "../../../utils/student-ra";
import type { ThemeColors } from "../../../ui/app-theme";
import { ConfirmCloseOverlay } from "../../../ui/ConfirmCloseOverlay";
import { DateInput } from "../../../ui/DateInput";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import {
    FormFieldValidationFeedback,
    type FormValidationIssue,
    getValidationFieldStyle,
} from "../../../ui/form-validation-feedback";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import type { ClassModalityFilterValue } from "../components/ClassModalityFilterChips";
import { getClassModalityLabel } from "../../../core/class-modality";
import { StudentAcademicFields } from "../components/StudentAcademicFields";
import { StudentClassDropdownList } from "../components/StudentClassDropdownPanel";
import { StudentDocumentsFields } from "../components/StudentDocumentsFields";
import { StudentMultiSelectOption } from "../components/StudentDropdownOptions";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useCollapsibleAnimation } from "../../../ui/use-collapsible";
import { useResponsiveLayout } from "../../../ui/use-responsive-layout";
import { BirthdayAvatar } from "../components/BirthdayAvatar";
import type { StudentFinanceSummary, StudentOperationalIndicator } from "../application/student-operational-indicators";
import { StudentFinanceSummaryPopover } from "../components/StudentFinanceSummaryPopover";
import { StudentOperationalHistoryModal } from "./StudentOperationalHistoryModal";
import { overlayLayers } from "../../../ui/overlay-layers";

type CollapsibleAnim = {
    animatedStyle: any;
    isVisible: boolean;
};

type Layout = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type StudentValidationField = "unitClass" | "name" | "birthDate" | "ra";

const operationalStyles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 14,
        flex: 1,
        minWidth: 280,
        overflow: "hidden",
    },
    strip: {
        flexDirection: "row",
        alignItems: "stretch",
    },
    cardTablet: {
        flexBasis: "100%",
    },
    stripStacked: {
        flexDirection: "column",
    },
    tile: {
        flex: 1,
        minWidth: 0,
        minHeight: 62,
        paddingVertical: 12,
        paddingHorizontal: 10,
        justifyContent: "center",
    },
    tileStacked: {
        width: "100%",
        minHeight: 56,
    },
    tileDividerHorizontal: {
        borderRightWidth: 1,
    },
    tileDividerVertical: {
        borderBottomWidth: 1,
    },
    tileHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
    },
    tileHeaderMain: {
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    tileState: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 6,
    },
    badgeContainer: { flexShrink: 1, minWidth: 0 },
    badgeLabel: { flexShrink: 1, fontSize: 11, fontWeight: "800" },
    badge: {
        flexShrink: 1,
        minWidth: 0,
        minHeight: 30,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    statusTrigger: {
        minHeight: 34,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    badgeDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    badgeReason: {
        padding: 8,
        fontSize: 12,
        fontWeight: "700",
    },
    interactiveTile: {
        flex: 1,
        minWidth: 0,
    },
    action: {
        minHeight: 34,
        paddingHorizontal: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    modalHeaderActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    historyAction: {
        minHeight: 40,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    statusOption: {
        minHeight: 24,
        justifyContent: "center",
    },
    statusOptionLabel: {
        fontSize: 12,
        fontWeight: "800",
    },
    inactivationForm: {
        gap: 8,
        borderTopWidth: 1,
        padding: 12,
    },
    inactivationActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 8,
    },
});

const indicatorPalette = (indicator: StudentOperationalIndicator, colors: ThemeColors) => {
    if (indicator.tone === "success") {
        return { backgroundColor: colors.successBg, borderColor: colors.successBorder, color: colors.successText };
    }
    if (indicator.tone === "warning") {
        return { backgroundColor: colors.warningBg, borderColor: colors.warningBorder, color: colors.warningText };
    }
    if (indicator.tone === "danger") {
        return { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder, color: colors.dangerText };
    }
    return { backgroundColor: colors.secondaryBg, borderColor: colors.border, color: colors.muted };
};

function OperationalIndicatorBadge({
    indicator,
    colors,
    showReason = false,
    reasonVisible = false,
    onShowReason,
    onHideReason,
}: {
    indicator: StudentOperationalIndicator;
    colors: ThemeColors;
    showReason?: boolean;
    reasonVisible?: boolean;
    onShowReason?: () => void;
    onHideReason?: () => void;
}) {
    const reasonTriggerRef = useRef<View | null>(null);
    const [reasonLayout, setReasonLayout] = useState<Layout | null>(null);
    const openReason = () => {
        reasonTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setReasonLayout({ x, y, width, height });
            onShowReason?.();
        });
    };
    const palette = indicatorPalette(indicator, colors);
    const badge = (
        <View
            style={[operationalStyles.badge, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}
        >
            <View style={[operationalStyles.badgeDot, { backgroundColor: palette.color }]} />
            <Text style={[operationalStyles.badgeLabel, { color: palette.color }]}>{indicator.label}</Text>
        </View>
    );

    if (!showReason) {
        return (
            <View accessibilityRole="text" accessibilityLabel={indicator.label} style={operationalStyles.badgeContainer}>
                {badge}
            </View>
        );
    }

    return (
        <View ref={reasonTriggerRef} style={operationalStyles.badgeContainer}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${indicator.label}. ${indicator.detail}`}
                accessibilityHint="Mostra o motivo do aviso"
                accessibilityState={{ expanded: reasonVisible }}
                onPress={openReason}
                onFocus={openReason}
                onBlur={onHideReason}
                onHoverIn={() => {
                    if (Platform.OS === "web") openReason();
                }}
                onHoverOut={() => {
                    if (Platform.OS === "web") onHideReason?.();
                }}
                suppressWebHoverFeedback
            >
                {badge}
            </Pressable>
            <AnchoredDropdown
                visible={reasonVisible}
                layout={reasonLayout}
                container={null}
                animationStyle={null}
                zIndex={overlayLayers.floatingList}
                maxHeight={100}
                nestedScrollEnabled={false}
                density="menu"
                preferredWidth={220}
                fitContent
                portalToBodyOnWeb
                interactiveRefs={[reasonTriggerRef]}
                onRequestClose={onHideReason}
                showVerticalScrollIndicator={false}
            >
                <Text accessibilityRole="text" style={[operationalStyles.badgeReason, { color: colors.text }]}>
                    {indicator.detail}
                </Text>
            </AnchoredDropdown>
        </View>
    );
}
function OperationalIndicatorTile({
    title,
    indicator,
    colors,
    stacked,
    isLast,
    onPress,
    accessibilityLabel,
    showReason,
    reasonVisible,
    onShowReason,
    onHideReason,
    triggerRef,
    expanded,
}: {
    title: string;
    indicator: StudentOperationalIndicator;
    colors: ThemeColors;
    stacked: boolean;
    isLast: boolean;
    onPress?: () => void;
    accessibilityLabel?: string;
    showReason?: boolean;
    reasonVisible?: boolean;
    onShowReason?: () => void;
    onHideReason?: () => void;
    triggerRef?: RefObject<View | null>;
    expanded?: boolean;
}) {
    const content = (
        <View style={operationalStyles.tileHeader}>
            <View style={operationalStyles.tileHeaderMain}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                    {title}
                </Text>
            </View>
            <View style={operationalStyles.tileState}>
                <OperationalIndicatorBadge
                    indicator={indicator}
                    colors={colors}
                    showReason={showReason}
                    reasonVisible={reasonVisible}
                    onShowReason={onShowReason}
                    onHideReason={onHideReason}
                />
                {onPress ? <GoAtletaIcon name="chevronForward" size={16} color={colors.muted} /> : null}
            </View>
        </View>
    );
    const tileStyle = [
        operationalStyles.tile,
        stacked ? operationalStyles.tileStacked : null,
        !isLast
            ? stacked
                ? operationalStyles.tileDividerVertical
                : operationalStyles.tileDividerHorizontal
            : null,
        { borderColor: colors.border, backgroundColor: colors.card },
    ];

    if (onPress) {
        return (
            <View ref={triggerRef} style={operationalStyles.interactiveTile}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityState={{ expanded }}
                onPress={onPress}
                style={({ pressed, hovered }: any) => [
                    tileStyle,
                    { backgroundColor: hovered ? colors.secondaryBg : colors.card, opacity: pressed ? 0.76 : 1 },
                ]}
            >
                {content}
            </Pressable>
            </View>
        );
    }

    return <View style={tileStyle}>{content}</View>;
}

const VOLLEYBALL_POSITION_OPTIONS: Array<{ value: Student["positionPrimary"]; label: string }> = [
    { value: "levantador", label: "Levantador" },
    { value: "oposto", label: "Oposto" },
    { value: "ponteiro", label: "Ponteiro" },
    { value: "central", label: "Central" },
    { value: "libero", label: "Líbero" },
];

type SelectOptionProps = {
    label: string;
    value: string;
    active: boolean;
    onSelect: (value: string) => void;
    isFirst: boolean;
};

export type StudentEditModalProps = {
    // Modal visibility / card style
    showEditModal: boolean;
    requestCloseEditModal: () => void;
    editModalCardStyle: StyleProp<ViewStyle>;

    // Confirm close overlay
    showEditCloseConfirm: boolean;
    setShowEditCloseConfirm: (value: boolean) => void;
    closeEditModal: () => void;

    // Container ref / window
    editModalRef: RefObject<View | null>;
    setEditContainerWindow: (value: { x: number; y: number } | null) => void;

    // Photo
    photoUrl: string | null;
    photoDisplayUrl: string | null;
    setShowPhotoSheet: (value: boolean) => void;
    pickStudentPhoto: (source: "camera" | "library" | "remove") => Promise<void>;

    // Section accordion
    openEditSection: string | null;
    toggleEditSection: (
        section: "studentData" | "academic" | "documents" | "sportProfile" | "health" | "guardian" | "links"
    ) => void;
    editStudentDataAnim: CollapsibleAnim;
    editAcademicAnim: CollapsibleAnim;
    editDocumentsAnim: CollapsibleAnim;
    editSportAnim: CollapsibleAnim;
    editHealthAnim: CollapsibleAnim;
    editGuardianAnim: CollapsibleAnim;
    editLinksAnim: CollapsibleAnim;

    // Student data fields
    name: string;
    setName: (value: string) => void;
    collegeCourse: string;
    setCollegeCourse: (value: string) => void;
    loginEmail: string;
    setLoginEmail: (value: string) => void;
    birthDate: string;
    setBirthDate: (value: string) => void;
    ageNumber: number | null;
    phone: string;
    setPhone: (value: string) => void;
    studentFormError: string;
    validationIssue?: FormValidationIssue<StudentValidationField> | null;
    onClearValidation?: (field?: StudentValidationField) => void;
    setShowCalendar: (value: boolean) => void;

    // Formatters
    formatName: (value: string) => string;
    formatEmail: (value: string) => string;
    formatPhone: (value: string) => string;

    // Documents
    ra: string;
    setRa: (value: string) => void;
    cpfDisplay: string;
    setCpfDisplay: (value: string) => void;
    rgDocument: string;
    setRgDocument: (value: string) => void;
    editingId: string | null;
    canRevealCpf: boolean;
    isCpfVisible: boolean;
    revealCpfBusy: boolean;
    handleRevealEditingCpf: () => Promise<void>;
    studentDocumentsError: { ra?: string; cpf?: string; rg?: string };
    setIsCpfVisible: (value: boolean) => void;
    setCpfRevealedValue: (value: string | null) => void;
    setCpfRevealUnavailable: (value: boolean) => void;
    setStudentDocumentsError: (
        patch:
            | { ra?: string; cpf?: string; rg?: string }
            | ((prev: { ra?: string; cpf?: string; rg?: string }) => { ra?: string; cpf?: string; rg?: string })
    ) => void;
    editAcademicSummary: string;
    editDocumentsSummary: string;

    // Sport profile
    positionPrimary: string;
    setPositionPrimary: (value: Student["positionPrimary"]) => void;
    positionSecondary: string;
    setPositionSecondary: (value: Student["positionSecondary"]) => void;
    athleteObjective: string;
    setAthleteObjective: (value: Student["athleteObjective"]) => void;
    learningStyle: string;
    setLearningStyle: (value: Student["learningStyle"]) => void;
    editSportSummary: string;

    // Health
    healthIssue: boolean;
    setHealthIssue: (value: boolean) => void;
    healthIssueNotes: string;
    setHealthIssueNotes: (value: string) => void;
    medicationUse: boolean;
    setMedicationUse: (value: boolean) => void;
    medicationNotes: string;
    setMedicationNotes: (value: string) => void;
    healthObservations: string;
    setHealthObservations: (value: string) => void;
    editHealthSummary: string;

    // Guardian
    guardianName: string;
    setGuardianName: (value: string) => void;
    guardianPhone: string;
    setGuardianPhone: (value: string) => void;
    guardianRelation: string;
    editGuardianRelationTriggerRef: RefObject<View | null>;
    toggleEditPicker: (target: "unit" | "class" | "guardianRelation") => void;
    showEditGuardianRelationPicker: boolean;
    editGuardianSummary: string;
    guardianRelationOptions: string[];
    showEditGuardianRelationPickerContent: boolean;
    editGuardianRelationTriggerLayout: Layout | null;
    editGuardianRelationPickerAnimStyle: any;
    handleSelectEditGuardianRelation: (value: string) => void;

    // Links
    editUnitTriggerRef: RefObject<View | null>;
    showEditUnitPicker: boolean;
    selectedClassName: string;
    editClassTriggerRef: RefObject<View | null>;
    showEditClassPicker: boolean;
    editLinksSummary: string;
    unitOptions: string[];
    showEditUnitPickerContent: boolean;
    editContainerWindow: Point | null;
    editUnitPickerAnimStyle: any;
    selectedUnitFilters: string[];
    handleToggleEditUnitFilter: (value: string) => void;
    classOptions: ClassGroup[];
    classId: string;
    showEditClassPickerContent: boolean;
    editClassPickerAnimStyle: any;
    handleSelectEditClass: (value: ClassGroup) => void;

    // Close all pickers
    closeAllEditPickers: () => void;

    // Delete / Save
    operationalStudent: Student | null;
    operationalStatusSaving: boolean;
    canManageFinancialStatus: boolean;
    financeIndicator: StudentOperationalIndicator;
    financeSummary: StudentFinanceSummary | null;
    attendanceIndicator: StudentOperationalIndicator;
    operationalHistory: StudentOperationalEvent[];
    operationalHistoryLoading: boolean;
    operationalHistoryError: string;
    onRetryOperationalHistory: () => Promise<void>;
    onUpdateOperationalStatus: (patch: {
        membershipStatus?: Student["membershipStatus"];
        inactivationReason?: string | null;
    }) => Promise<boolean>;
    onOpenFinance: () => void;
    editSaving: boolean;
    setEditSaving: (value: boolean) => void;
    onSave: () => Promise<boolean>;
    isEditDirty: boolean;

    // Style helpers
    selectFieldStyle: object;

    // Colors
    colors: ThemeColors;

    // Option components (memoized in parent)
    SelectOption: NamedExoticComponent<SelectOptionProps>;
};

export function StudentEditModal({
    showEditModal,
    requestCloseEditModal,
    editModalCardStyle,
    showEditCloseConfirm,
    setShowEditCloseConfirm,
    closeEditModal,
    editModalRef,
    setEditContainerWindow,
    photoUrl,
    photoDisplayUrl,
    setShowPhotoSheet,
    pickStudentPhoto,
    openEditSection,
    toggleEditSection,
    editStudentDataAnim,
    editAcademicAnim,
    editDocumentsAnim,
    editSportAnim,
    editHealthAnim,
    editGuardianAnim,
    editLinksAnim,
    name,
    setName,
    collegeCourse,
    setCollegeCourse,
    loginEmail,
    setLoginEmail,
    birthDate,
    setBirthDate,
    ageNumber,
    phone,
    setPhone,
    studentFormError,
    validationIssue,
    onClearValidation,
    setShowCalendar,
    formatName,
    formatEmail,
    formatPhone,
    ra,
    setRa,
    cpfDisplay,
    setCpfDisplay,
    rgDocument,
    setRgDocument,
    editingId,
    canRevealCpf,
    isCpfVisible,
    revealCpfBusy,
    handleRevealEditingCpf,
    studentDocumentsError,
    setIsCpfVisible,
    setCpfRevealedValue,
    setCpfRevealUnavailable,
    setStudentDocumentsError,
    editAcademicSummary,
    editDocumentsSummary,
    positionPrimary,
    setPositionPrimary,
    positionSecondary,
    setPositionSecondary,
    athleteObjective,
    setAthleteObjective,
    learningStyle,
    setLearningStyle,
    editSportSummary,
    healthIssue,
    setHealthIssue,
    healthIssueNotes,
    setHealthIssueNotes,
    medicationUse,
    setMedicationUse,
    medicationNotes,
    setMedicationNotes,
    healthObservations,
    setHealthObservations,
    editHealthSummary,
    guardianName,
    setGuardianName,
    guardianPhone,
    setGuardianPhone,
    guardianRelation,
    editGuardianRelationTriggerRef,
    toggleEditPicker,
    showEditGuardianRelationPicker,
    editGuardianSummary,
    guardianRelationOptions,
    showEditGuardianRelationPickerContent,
    editGuardianRelationTriggerLayout,
    editGuardianRelationPickerAnimStyle,
    handleSelectEditGuardianRelation,
    editUnitTriggerRef,
    showEditUnitPicker,
    selectedClassName,
    editClassTriggerRef,
    showEditClassPicker,
    editLinksSummary,
    unitOptions,
    showEditUnitPickerContent,
    editContainerWindow,
    editUnitPickerAnimStyle,
    selectedUnitFilters,
    handleToggleEditUnitFilter,
    classOptions,
    classId,
    showEditClassPickerContent,
    editClassPickerAnimStyle,
    handleSelectEditClass,
    closeAllEditPickers,
    operationalStudent,
    operationalStatusSaving,
    canManageFinancialStatus,
    financeIndicator,
    financeSummary,
    attendanceIndicator,
    operationalHistory,
    operationalHistoryLoading,
    operationalHistoryError,
    onRetryOperationalHistory,
    onUpdateOperationalStatus,
    onOpenFinance,
    editSaving,
    setEditSaving,
    onSave,
    isEditDirty,
    selectFieldStyle,
    colors,
    SelectOption,
}: StudentEditModalProps) {
    const responsiveLayout = useResponsiveLayout("content");
    const nameInputRef = useRef<TextInput | null>(null);
    const birthDateInputRef = useRef<TextInput | null>(null);
    const raInputRef = useRef<TextInput | null>(null);
    const membershipStatusTriggerRef = useRef<View | null>(null);
    const financeTriggerRef = useRef<View | null>(null);
    const [financeTriggerLayout, setFinanceTriggerLayout] = useState<Layout | null>(null);
    const [showInactivationForm, setShowInactivationForm] = useState(false);
    const [inactivationReason, setInactivationReason] = useState("");
    const [showOperationalHistory, setShowOperationalHistory] = useState(false);
    const [activeOperationalOverlay, setActiveOperationalOverlay] = useState<"membership" | "finance" | "attendance" | null>(null);
    const showMembershipStatusMenu = activeOperationalOverlay === "membership";
    const closeOperationalOverlay = (overlay: "membership" | "finance" | "attendance") => {
        setActiveOperationalOverlay((current) => current === overlay ? null : current);
    };
    const setShowMembershipStatusMenu = (visible: boolean) => {
        if (visible) setActiveOperationalOverlay("membership");
        else closeOperationalOverlay("membership");
    };
    const openFinanceSummary = () => {
        financeTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setFinanceTriggerLayout({ x, y, width, height });
            setActiveOperationalOverlay("finance");
        });
    };
    const [membershipStatusTriggerLayout, setMembershipStatusTriggerLayout] = useState<Layout | null>(null);
    const membershipStatusMenuAnim = useCollapsibleAnimation(showMembershipStatusMenu, {
        durationIn: 150,
        durationOut: 110,
        translateY: -3,
    });

    useEffect(() => {
        setActiveOperationalOverlay(null);
    }, [operationalStudent?.id, showEditModal]);

    useEffect(() => {
        if (!showEditModal || operationalStudent?.membershipStatus === "inactive") {
            setShowInactivationForm(false);
            setInactivationReason("");
        }
        if (!showEditModal) {
            setShowOperationalHistory(false);
            setShowMembershipStatusMenu(false);
        }
    }, [operationalStudent?.id, operationalStudent?.membershipStatus, showEditModal]);

    const toggleMembershipStatusMenu = () => {
        if (operationalStatusSaving) return;
        if (showMembershipStatusMenu) {
            setShowMembershipStatusMenu(false);
            return;
        }
        membershipStatusTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setMembershipStatusTriggerLayout({ x, y, width, height });
            setShowMembershipStatusMenu(true);
        });
    };

    const selectMembershipStatus = (membershipStatus: NonNullable<Student["membershipStatus"]>) => {
        setShowMembershipStatusMenu(false);
        if (membershipStatus === operationalStudent?.membershipStatus) return;
        if (membershipStatus === "inactive") {
            setShowInactivationForm(true);
            return;
        }
        void onUpdateOperationalStatus({ membershipStatus: "active" });
    };

    const membershipIndicator: StudentOperationalIndicator = operationalStudent?.membershipStatus === "inactive"
        ? { label: "Inativo", detail: "Fora das novas chamadas", tone: "danger" }
        : { label: "Ativo", detail: "Disponível nas turmas e chamadas", tone: "success" };

    useEffect(() => {
        if (!showEditModal || !validationIssue) return undefined;
        const target =
            validationIssue.field === "name"
                ? nameInputRef
                : validationIssue.field === "birthDate"
                    ? birthDateInputRef
                    : validationIssue.field === "ra"
                        ? raInputRef
                        : null;
        if (!target) return undefined;
        const timer = setTimeout(() => target.current?.focus(), 180);
        return () => clearTimeout(timer);
    }, [showEditModal, validationIssue]);

    const [classModalityFilter, setClassModalityFilter] = useState<ClassModalityFilterValue>("all");
    const [showSportModalityPicker, setShowSportModalityPicker] = useState(false);
    const sportModalityPickerAnim = useCollapsibleAnimation(showSportModalityPicker, {
        durationIn: 160,
        durationOut: 120,
        translateY: -3,
    });
    const [showPositionPicker, setShowPositionPicker] = useState(false);
    const positionPickerAnim = useCollapsibleAnimation(showPositionPicker, {
        durationIn: 160,
        durationOut: 120,
        translateY: -3,
    });
    const selectedPositions = useMemo(
        () => Array.from(new Set([positionPrimary, positionSecondary].filter((position) => position !== "indefinido"))),
        [positionPrimary, positionSecondary]
    );
    const selectedPositionsLabel = selectedPositions.length
        ? selectedPositions.map((position) => VOLLEYBALL_POSITION_OPTIONS.find((option) => option.value === position)?.label ?? position).join(" • ")
        : "Indefinido";
    const selectedClass = useMemo(
        () => classOptions.find((item) => item.id === classId) ?? null,
        [classId, classOptions]
    );
    const selectedClassModality = selectedClass?.modality ?? null;
    const selectedModalityLabel = classModalityFilter !== "all"
          ? getClassModalityLabel(classModalityFilter)
          : selectedClassModality
            ? getClassModalityLabel(selectedClassModality)
            : "Modalidade não informada";
    const classModalities = useMemo(
        () => Array.from(new Set(classOptions.map((item) => item.modality))),
        [classOptions]
    );
    const selectedUnitFilterLabel = useMemo(() => {
        if (selectedUnitFilters.length === 0) return "Todas as unidades";
        if (selectedUnitFilters.length === 1) return selectedUnitFilters[0] ?? "Todas as unidades";
        return `${selectedUnitFilters.length} unidades selecionadas`;
    }, [selectedUnitFilters]);
    const filteredClassOptions = useMemo(
        () =>
            classModalityFilter === "all"
                ? classOptions
                : classOptions.filter((item) => item.modality === classModalityFilter),
        [classModalityFilter, classOptions]
    );
    const editHealthAssessment = useMemo(
        () =>
            deriveStudentHealthAssessment({
                healthIssue,
                healthIssueNotes,
                medicationUse,
                medicationNotes,
                healthObservations,
            }),
        [healthIssue, healthIssueNotes, healthObservations, medicationNotes, medicationUse]
    );

    useEffect(() => {
        if (!showEditClassPicker) return;
        Promise.resolve().then(() => {
          setClassModalityFilter(selectedClassModality ?? "all");
        });
    }, [selectedClassModality, showEditClassPicker]);

    useEffect(() => {
        if (!showEditClassPicker) return;
        if (classModalityFilter === "all") return;
        if (!classModalities.includes(classModalityFilter)) {
            Promise.resolve().then(() => {
              setClassModalityFilter(selectedClassModality ?? "all");
            });
        }
    }, [classModalities, classModalityFilter, selectedClassModality, showEditClassPicker]);

    return (
        <>
        <ModalSheet
            visible={showEditModal}
            onClose={
                showOperationalHistory
                    ? () => setShowOperationalHistory(false)
                    : activeOperationalOverlay
                        ? () => setActiveOperationalOverlay(null)
                        : requestCloseEditModal
            }
            cardStyle={[editModalCardStyle, { height: Platform.OS === "web" ? "92%" : "90%" }]}
            position="center"
            containerPadding={Platform.OS === "web" ? 16 : 8}
        >
            <View
                ref={editModalRef}
                onLayout={() => {
                    editModalRef.current?.measureInWindow((x, y) => {
                        setEditContainerWindow({ x, y });
                    });
                }}
                style={{ position: "relative", width: "100%", flex: 1, minHeight: 0 }}
            >
                <ConfirmCloseOverlay
                    visible={showEditCloseConfirm}
                    onCancel={() => setShowEditCloseConfirm(false)}
                    onConfirm={() => {
                        setShowEditCloseConfirm(false);
                        closeEditModal();
                    }}
                />
                <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
                            Editar aluno
                        </Text>
                        <View style={operationalStyles.modalHeaderActions}>
                            {operationalStudent ? (
                                <Pressable
                                    onPress={() => setShowOperationalHistory(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Ver histórico do aluno"
                                    hitSlop={8}
                                    style={({ pressed, hovered }: any) => [
                                        operationalStyles.historyAction,
                                        {
                                            backgroundColor: hovered ? colors.secondaryBg : colors.card,
                                            borderColor: hovered ? colors.primaryBg : colors.border,
                                            opacity: pressed ? 0.76 : 1,
                                        },
                                    ]}
                                    suppressWebHoverFeedback
                                >
                                    <GoAtletaIcon name="time" size={15} color={colors.muted} />
                                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Histórico</Text>
                                </Pressable>
                            ) : null}
                            <Pressable
                                onPress={requestCloseEditModal}
                                accessibilityRole="button"
                                accessibilityLabel="Fechar edição do aluno"
                                hitSlop={8}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: colors.secondaryBg,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <GoAtletaIcon name="close" size={18} color={colors.text} />
                            </Pressable>
                        </View>
                    </View>
                    <ScrollView
                        style={{ width: "100%", flex: 1 }}
                        contentContainerStyle={{ gap: 10, paddingBottom: 96 }}
                        keyboardShouldPersistTaps="handled"
                        automaticallyAdjustKeyboardInsets
                        onScrollBeginDrag={() => {
                            closeAllEditPickers();
                            setActiveOperationalOverlay(null);
                        }}
                    >
                        <View style={{ gap: 10 }}>
                            <View style={{ flexDirection: "row", alignItems: "stretch", flexWrap: "wrap", gap: 12 }}>
                            <View
                                style={{
                                    flexBasis: 190,
                                    minWidth: 190,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 12,
                                    paddingHorizontal: 4,
                                }}
                            >
                                <Pressable
                                    onPress={() => setShowPhotoSheet(true)}
                                    style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 36,
                                        backgroundColor: colors.secondaryBg,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        overflow: "hidden",
                                    }}
                                >
                                    <BirthdayAvatar
                                        colors={colors}
                                        photoUrl={photoDisplayUrl ?? undefined}
                                        size={72}
                                    />
                                </Pressable>
                                <View style={{ gap: 6 }}>
                                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                                        {photoUrl ? "Alterar foto" : "Adicionar foto"}
                                    </Text>
                                    <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                                        <Pressable onPress={() => void pickStudentPhoto("library")}>
                                            <Text style={{ fontSize: 12, color: colors.text, fontWeight: "700" }}>Galeria</Text>
                                        </Pressable>
                                        <Pressable onPress={() => void pickStudentPhoto("camera")}>
                                            <Text style={{ fontSize: 12, color: colors.text, fontWeight: "700" }}>Tirar foto</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>

                            {operationalStudent ? (
                                <View
                                    style={[
                                        operationalStyles.card,
                                        responsiveLayout.tier === "tablet" ? operationalStyles.cardTablet : null,
                                        { borderColor: colors.border, backgroundColor: colors.card },
                                    ]}
                                >
                                    <View
                                        style={[
                                            operationalStyles.strip,
                                            responsiveLayout.isMobile ? operationalStyles.stripStacked : null,
                                        ]}
                                    >
                                        <View
                                            style={[
                                                operationalStyles.tile,
                                                responsiveLayout.isMobile ? operationalStyles.tileStacked : null,
                                                responsiveLayout.isMobile
                                                    ? operationalStyles.tileDividerVertical
                                                    : operationalStyles.tileDividerHorizontal,
                                                { borderColor: colors.border, backgroundColor: colors.card },
                                            ]}
                                        >
                                            <View style={operationalStyles.tileHeader}>
                                                <View style={operationalStyles.tileHeaderMain}>
                                                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>Cadastro</Text>
                                                </View>
                                                <View ref={membershipStatusTriggerRef} collapsable={false}>
                                                    <Pressable
                                                        disabled={operationalStatusSaving}
                                                        onPress={toggleMembershipStatusMenu}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Cadastro: ${membershipIndicator.label}`}
                                                        accessibilityState={{ expanded: showMembershipStatusMenu }}
                                                        style={(state) => {
                                                            const palette = indicatorPalette(membershipIndicator, colors);
                                                            return [
                                                                operationalStyles.statusTrigger,
                                                                {
                                                                    backgroundColor: palette.backgroundColor,
                                                                    borderColor: showMembershipStatusMenu || state.hovered
                                                                        ? palette.color
                                                                        : palette.borderColor,
                                                                    opacity: operationalStatusSaving || state.pressed ? 0.62 : 1,
                                                                },
                                                            ];
                                                        }}
                                                    >
                                                        <View
                                                            style={[
                                                                operationalStyles.badgeDot,
                                                                { backgroundColor: indicatorPalette(membershipIndicator, colors).color },
                                                            ]}
                                                        />
                                                        <Text
                                                            style={{
                                                                color: indicatorPalette(membershipIndicator, colors).color,
                                                                fontSize: 11,
                                                                fontWeight: "800",
                                                            }}
                                                        >
                                                            {membershipIndicator.label}
                                                        </Text>
                                                        <GoAtletaIcon
                                                            name={showMembershipStatusMenu ? "chevronUp" : "chevronDown"}
                                                            size={13}
                                                            color={indicatorPalette(membershipIndicator, colors).color}
                                                        />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        </View>

                                        {canManageFinancialStatus ? (
                                            <OperationalIndicatorTile
                                                title="Financeiro"
                                                indicator={financeIndicator}
                                                colors={colors}
                                                stacked={responsiveLayout.isMobile}
                                                isLast={false}
                                                onPress={openFinanceSummary}
                                                triggerRef={financeTriggerRef}
                                                expanded={activeOperationalOverlay === "finance"}
                                                accessibilityLabel={"Ver resumo financeiro de " + operationalStudent.name}
                                            />
                                        ) : null}
                                        <OperationalIndicatorTile
                                            title="Frequência"
                                            indicator={attendanceIndicator}
                                            colors={colors}
                                            stacked={responsiveLayout.isMobile}
                                            isLast
                                            showReason={attendanceIndicator.tone === "warning" || attendanceIndicator.tone === "danger"}
                                            reasonVisible={activeOperationalOverlay === "attendance"}
                                            onShowReason={() => setActiveOperationalOverlay("attendance")}
                                            onHideReason={() => closeOperationalOverlay("attendance")}
                                        />
                                    </View>

                                    {canManageFinancialStatus ? (
                                        <StudentFinanceSummaryPopover
                                            visible={activeOperationalOverlay === "finance"}
                                            layout={financeTriggerLayout}
                                            triggerRef={financeTriggerRef}
                                            summary={financeSummary}
                                            indicator={financeIndicator}
                                            colors={colors}
                                            onClose={() => closeOperationalOverlay("finance")}
                                            onOpenFinance={onOpenFinance}
                                        />
                                    ) : null}

                                    <AnchoredDropdown
                                        visible={showMembershipStatusMenu}
                                        layout={membershipStatusTriggerLayout}
                                        container={null}
                                        animationStyle={membershipStatusMenuAnim.animatedStyle}
                                        zIndex={22000}
                                        maxHeight={180}
                                        nestedScrollEnabled
                                        density="menu"
                                        fitContent
                                        preferredWidth={190}
                                        portalToBodyOnWeb
                                        interactiveRefs={[membershipStatusTriggerRef]}
                                        showVerticalScrollIndicator={false}
                                        onRequestClose={() => setShowMembershipStatusMenu(false)}
                                        panelStyle={{ backgroundColor: colors.card }}
                                    >
                                        <AnchoredDropdownOption
                                            active={operationalStudent.membershipStatus !== "inactive"}
                                            density="compact"
                                            onPress={() => selectMembershipStatus("active")}
                                            rightAccessory={operationalStudent.membershipStatus !== "inactive"
                                                ? <GoAtletaIcon name="checkmark" size={15} color={colors.successText} />
                                                : undefined}
                                        >
                                            <View style={operationalStyles.statusOption}>
                                                <Text
                                                    style={[
                                                        operationalStyles.statusOptionLabel,
                                                        {
                                                            color: operationalStudent.membershipStatus !== "inactive"
                                                                ? colors.primaryText
                                                                : colors.text,
                                                        },
                                                    ]}
                                                >
                                                    Ativo
                                                </Text>
                                            </View>
                                        </AnchoredDropdownOption>
                                        <AnchoredDropdownOption
                                            active={operationalStudent.membershipStatus === "inactive"}
                                            density="compact"
                                            onPress={() => selectMembershipStatus("inactive")}
                                            rightAccessory={operationalStudent.membershipStatus === "inactive"
                                                ? <GoAtletaIcon name="checkmark" size={15} color={colors.dangerText} />
                                                : undefined}
                                        >
                                            <View style={operationalStyles.statusOption}>
                                                <Text
                                                    style={[
                                                        operationalStyles.statusOptionLabel,
                                                        {
                                                            color: operationalStudent.membershipStatus === "inactive"
                                                                ? colors.primaryText
                                                                : colors.text,
                                                        },
                                                    ]}
                                                >
                                                    Inativo
                                                </Text>
                                            </View>
                                        </AnchoredDropdownOption>
                                    </AnchoredDropdown>

                                    {showInactivationForm ? (
                                        <View style={[operationalStyles.inactivationForm, { borderTopColor: colors.border }]}>
                                            <View
                                                style={{
                                                    minHeight: 50,
                                                    borderRadius: 12,
                                                    paddingHorizontal: 14,
                                                    backgroundColor: colors.inputBg,
                                                    borderWidth: 1,
                                                    borderColor: colors.border,
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <TextInput
                                                    value={inactivationReason}
                                                    onChangeText={(value) => setInactivationReason(value.slice(0, 240))}
                                                    placeholder="Motivo da inativação"
                                                    placeholderTextColor={colors.muted}
                                                    maxLength={240}
                                                    style={{
                                                        color: colors.text,
                                                        fontSize: 13,
                                                        paddingVertical: 0,
                                                        borderRadius: 0,
                                                        outlineStyle: "none",
                                                    } as any}
                                                />
                                            </View>
                                            <Text style={{ color: colors.muted, fontSize: 11 }}>
                                                Histórico, avaliações e presenças serão preservados.
                                            </Text>
                                            <View style={operationalStyles.inactivationActions}>
                                                <Pressable
                                                    disabled={operationalStatusSaving}
                                                    onPress={() => {
                                                        setShowInactivationForm(false);
                                                        setInactivationReason("");
                                                    }}
                                                    style={operationalStyles.action}
                                                    suppressWebHoverFeedback
                                                >
                                                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Cancelar</Text>
                                                </Pressable>
                                                <Pressable
                                                    disabled={operationalStatusSaving || !inactivationReason.trim()}
                                                    onPress={() => {
                                                        void onUpdateOperationalStatus({
                                                            membershipStatus: "inactive",
                                                            inactivationReason,
                                                        }).then((updated) => {
                                                            if (updated) {
                                                                setShowInactivationForm(false);
                                                                setInactivationReason("");
                                                            }
                                                        });
                                                    }}
                                                    style={{
                                                        minHeight: 40,
                                                        borderRadius: 10,
                                                        backgroundColor: colors.dangerSolidBg,
                                                        paddingHorizontal: 12,
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        opacity: operationalStatusSaving || !inactivationReason.trim() ? 0.55 : 1,
                                                    }}
                                                >
                                                    <Text style={{ color: colors.dangerSolidText, fontSize: 12, fontWeight: "800" }}>
                                                        {operationalStatusSaving ? "Inativando..." : "Confirmar"}
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}
                            </View>

                            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
                                <Pressable
                                    onPress={() => toggleEditSection("studentData")}
                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
                                >
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Dados do aluno</Text>
                                        <Text style={{ color: colors.muted, fontSize: 11 }}>Nome, contato e login</Text>
                                    </View>
                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: openEditSection === "studentData" ? "180deg" : "0deg" }] }} />
                                </Pressable>
                                {openEditSection === "studentData" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
                                {editStudentDataAnim.isVisible ? (
                                    <Animated.View style={[editStudentDataAnim.animatedStyle, { overflow: "hidden" }]}>
                                        <View style={{ gap: 10, padding: 12 }}>
                                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                                                <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                                                    <Text style={{ color: colors.muted, fontSize: 11 }}>Nome do aluno</Text>
                                                    <FormFieldValidationFeedback
                                                        message={validationIssue?.field === "name" ? validationIssue.message : ""}
                                                        attempt={validationIssue?.field === "name" ? validationIssue.attempt : 0}
                                                    >
                                                        <TextInput
                                                            ref={nameInputRef}
                                                            placeholder="Nome do aluno"
                                                            value={name}
                                                            onChangeText={(value) => {
                                                                onClearValidation?.("name");
                                                                setName(value);
                                                            }}
                                                            accessibilityLabel="Nome do aluno"
                                                            placeholderTextColor={colors.placeholder}
                                                            style={[
                                                                { borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 13, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText },
                                                                getValidationFieldStyle(validationIssue?.field === "name", colors.dangerSolidBg),
                                                            ]}
                                                        />
                                                    </FormFieldValidationFeedback>
                                                </View>
                                                <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                                                    <Text style={{ color: colors.muted, fontSize: 11 }}>Email do aluno (login)</Text>
                                                    <TextInput
                                                        placeholder="email@exemplo.com"
                                                        value={loginEmail}
                                                        onChangeText={setLoginEmail}
                                                        keyboardType="email-address"
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                        placeholderTextColor={colors.placeholder}
                                                        style={{ borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 13, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }}
                                                    />
                                                </View>
                                            </View>
                                            {studentFormError ? <Text style={{ color: colors.dangerText, fontSize: 12 }}>{studentFormError}</Text> : null}
                                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                                                <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                                                    <FormFieldValidationFeedback
                                                        message={validationIssue?.field === "birthDate" ? validationIssue.message : ""}
                                                        attempt={validationIssue?.field === "birthDate" ? validationIssue.attempt : 0}
                                                    >
                                                        <DateInput
                                                            inputRef={birthDateInputRef}
                                                            value={birthDate}
                                                            onChange={(value) => {
                                                                onClearValidation?.("birthDate");
                                                                setBirthDate(value);
                                                            }}
                                                            placeholder="Data de nascimento"
                                                            onOpenCalendar={() => setShowCalendar(true)}
                                                            invalid={validationIssue?.field === "birthDate"}
                                                        />
                                                    </FormFieldValidationFeedback>
                                                    <Text style={{ color: colors.muted, fontSize: 12 }}>{ageNumber !== null ? `Idade: ${ageNumber} anos` : "Idade calculada automaticamente"}</Text>
                                                </View>
                                                <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                                                    <TextInput
                                                        placeholder="Telefone"
                                                        value={phone}
                                                        onChangeText={(value) => setPhone(formatPhone(value))}
                                                        keyboardType="phone-pad"
                                                        placeholderTextColor={colors.placeholder}
                                                        style={{ borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 13, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }}
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>

                            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
                                <Pressable
                                    onPress={() => toggleEditSection("academic")}
                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
                                >
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Perfil Acadêmico</Text>
                                        <Text style={{ color: colors.muted, fontSize: 11 }}>{editAcademicSummary}</Text>
                                    </View>
                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: openEditSection === "academic" ? "180deg" : "0deg" }] }} />
                                </Pressable>
                                {openEditSection === "academic" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
                                {editAcademicAnim.isVisible ? (
                                    <Animated.View style={[editAcademicAnim.animatedStyle, { overflow: "hidden" }]}>
                                        <View style={{ gap: 10, padding: 12 }}>
                                            <StudentAcademicFields
                                                ra={ra}
                                                collegeCourse={collegeCourse}
                                                onChangeRa={(value) => {
                                                    onClearValidation?.("ra");
                                                    setRa(normalizeRaDigits(value));
                                                    setStudentDocumentsError((prev) => ({ ...prev, ra: undefined }));
                                                }}
                                                onChangeCollegeCourse={setCollegeCourse}
                                                errors={{
                                                    ...studentDocumentsError,
                                                    ra: validationIssue?.field === "ra" ? validationIssue.message : studentDocumentsError.ra,
                                                }}
                                                raInputRef={raInputRef}
                                                validationAttempt={validationIssue?.field === "ra" ? validationIssue.attempt : 0}
                                            />
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>

                            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
                                <Pressable
                                    onPress={() => toggleEditSection("documents")}
                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
                                >
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Documentos</Text>
                                        <Text style={{ color: colors.muted, fontSize: 11 }}>{editDocumentsSummary}</Text>
                                    </View>
                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: openEditSection === "documents" ? "180deg" : "0deg" }] }} />
                                </Pressable>
                                {openEditSection === "documents" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
                                {editDocumentsAnim.isVisible ? (
                                    <Animated.View style={[editDocumentsAnim.animatedStyle, { overflow: "hidden" }]}>
                                        <View style={{ gap: 10, padding: 12 }}>
                                            <StudentDocumentsFields
                                                cpfDisplay={cpfDisplay}
                                                rg={rgDocument}
                                                onChangeCpf={(value) => {
                                                    setCpfDisplay(value);
                                                    setIsCpfVisible(false);
                                                    setCpfRevealedValue(null);
                                                    setCpfRevealUnavailable(false);
                                                    setStudentDocumentsError((prev) => ({ ...prev, cpf: undefined }));
                                                }}
                                                onChangeRg={setRgDocument}
                                                showRevealCpfButton={Boolean(editingId && canRevealCpf)}
                                                isCpfVisible={isCpfVisible}
                                                revealCpfBusy={revealCpfBusy}
                                                onRevealCpf={handleRevealEditingCpf}
                                                errors={studentDocumentsError}
                                            />
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>

                            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
                                <Pressable
                                    onPress={() => toggleEditSection("sportProfile")}
                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
                                >
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Perfil esportivo</Text>
                                        <Text style={{ color: colors.muted, fontSize: 11 }}>{editSportSummary}</Text>
                                    </View>
                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: openEditSection === "sportProfile" ? "180deg" : "0deg" }] }} />
                                </Pressable>
                                {openEditSection === "sportProfile" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
                                {editSportAnim.isVisible ? (
                                    <Animated.View style={[editSportAnim.animatedStyle, { overflow: "hidden" }]}>
                                        <View style={{ gap: 10, padding: 12 }}>
                                            <View style={{ gap: 4 }}>
                                                <Text style={{ color: colors.muted, fontSize: 11 }}>Modalidade que pratica</Text>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Selecionar modalidade esportiva"
                                                    accessibilityState={{ expanded: showSportModalityPicker }}
                                                    onPress={() => setShowSportModalityPicker((current) => !current)}
                                                    style={selectFieldStyle as StyleProp<ViewStyle>}
                                                >
                                                    <Text style={{ color: colors.inputText, fontSize: 13, fontWeight: "600" }}>{selectedModalityLabel}</Text>
                                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: showSportModalityPicker ? "180deg" : "0deg" }] }} />
                                                </Pressable>
                                                {sportModalityPickerAnim.isVisible ? (
                                                    <Animated.View style={[sportModalityPickerAnim.animatedStyle, { overflow: "hidden" }]}>
                                                        <View style={{ maxHeight: 142, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, overflow: "hidden" }}>
                                                            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ padding: 6, gap: 4 }}>
                                                                {classModalities.length ? classModalities.map((modality, index) => (
                                                                    <StudentMultiSelectOption
                                                                        key={modality}
                                                                        label={getClassModalityLabel(modality)}
                                                                        value={modality}
                                                                        active={classModalityFilter === modality || selectedClassModality === modality}
                                                                        onToggle={(value) => {
                                                                            const selectedModality = value as ClassGroup["modality"];
                                                                            setClassModalityFilter(selectedModality);
                                                                            const firstCompatibleClass = classOptions.find((item) => item.modality === selectedModality);
                                                                            if (firstCompatibleClass && selectedClassModality !== selectedModality) handleSelectEditClass(firstCompatibleClass);
                                                                        }}
                                                                        isFirst={index === 0}
                                                                        compact
                                                                    />
                                                                )) : (
                                                                    <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>Nenhuma modalidade cadastrada.</Text>
                                                                )}
                                                            </ScrollView>
                                                        </View>
                                                    </Animated.View>
                                                ) : null}
                                            </View>
                                            <View style={{ gap: 4 }}>
                                                <Text style={{ color: colors.muted, fontSize: 11 }}>Posições que joga</Text>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Selecionar posições do voleibol"
                                                    accessibilityState={{ expanded: showPositionPicker }}
                                                    onPress={() => setShowPositionPicker((current) => !current)}
                                                    style={selectFieldStyle as StyleProp<ViewStyle>}
                                                >
                                                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>{selectedPositionsLabel}</Text>
                                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: showPositionPicker ? "180deg" : "0deg" }] }} />
                                                </Pressable>
                                                {positionPickerAnim.isVisible ? (
                                                    <Animated.View style={[positionPickerAnim.animatedStyle, { overflow: "hidden" }]}>
                                                        <View style={{ maxHeight: 190, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, overflow: "hidden" }}>
                                                            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ padding: 6, gap: 4 }}>
                                                                {VOLLEYBALL_POSITION_OPTIONS.map((option, index) => {
                                                                    const active = selectedPositions.includes(option.value);
                                                                    return (
                                                                        <StudentMultiSelectOption
                                                                            key={option.value}
                                                                            label={option.label}
                                                                            value={option.value}
                                                                            active={active}
                                                                            onToggle={(value) => {
                                                                                const position = value as Student["positionPrimary"];
                                                                                const next = active
                                                                                    ? selectedPositions.filter((item) => item !== position)
                                                                                    : [...selectedPositions.filter((item) => item !== position), position].slice(-2);
                                                                                setPositionPrimary((next[0] as Student["positionPrimary"]) ?? "indefinido");
                                                                                setPositionSecondary((next[1] as Student["positionSecondary"]) ?? "indefinido");
                                                                            }}
                                                                            isFirst={index === 0}
                                                                            compact
                                                                        />
                                                                    );
                                                                })}
                                                            </ScrollView>
                                                        </View>
                                                    </Animated.View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>

                            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
                                <Pressable
                                    onPress={() => toggleEditSection("health")}
                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
                                >
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Saúde</Text>
                                            {editHealthAssessment.level !== "apto" ? (
                                                <View
                                                    style={{
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        borderColor:
                                                            editHealthAssessment.level === "revisar"
                                                                ? colors.dangerBorder
                                                                : colors.warningBg,
                                                        backgroundColor:
                                                            editHealthAssessment.level === "revisar"
                                                                ? colors.dangerBg
                                                                : colors.warningBg,
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 2,
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            color:
                                                                editHealthAssessment.level === "revisar"
                                                                    ? colors.dangerText
                                                                    : colors.warningText,
                                                            fontSize: 10,
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {editHealthAssessment.label}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={{ color: colors.muted, fontSize: 11 }}>{editHealthSummary}</Text>
                                    </View>
                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: openEditSection === "health" ? "180deg" : "0deg" }] }} />
                                </Pressable>
                                {openEditSection === "health" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
                                {editHealthAnim.isVisible ? (
                                    <Animated.View style={[editHealthAnim.animatedStyle, { overflow: "hidden" }]}>
                                        <View style={{ gap: 10, padding: 12 }}>
                                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                                                <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
                                                    <Text style={{ color: colors.muted, fontSize: 11 }}>Observações sobre saúde do aluno</Text>
                                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                                        <Pressable
                                                            onPress={() => {
                                                                setHealthIssue(false);
                                                                setHealthIssueNotes("");
                                                            }}
                                                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: !healthIssue ? colors.primaryBg : colors.secondaryBg, borderWidth: 1, borderColor: !healthIssue ? colors.primaryBg : colors.border }}
                                                        >
                                                            <Text style={{ color: !healthIssue ? colors.primaryText : colors.text, fontWeight: "700" }}>Não</Text>
                                                        </Pressable>
                                                        <Pressable
                                                            onPress={() => setHealthIssue(true)}
                                                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: healthIssue ? colors.primaryBg : colors.secondaryBg, borderWidth: 1, borderColor: healthIssue ? colors.primaryBg : colors.border }}
                                                        >
                                                            <Text style={{ color: healthIssue ? colors.primaryText : colors.text, fontWeight: "700" }}>Sim</Text>
                                                        </Pressable>
                                                    </View>
                                                    {healthIssue ? (
                                                        <TextInput
                                                            placeholder="Descreva a observação"
                                                            value={healthIssueNotes}
                                                            onChangeText={setHealthIssueNotes}
                                                            placeholderTextColor={colors.placeholder}
                                                            multiline
                                                            style={{ borderWidth: 1, borderColor: colors.border, padding: 10, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText, minHeight: 70, textAlignVertical: "top" }}
                                                        />
                                                    ) : null}
                                                </View>
                                                <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
                                                    <Text style={{ color: colors.muted, fontSize: 11 }}>Uso contínuo de medicação</Text>
                                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                                        <Pressable
                                                            onPress={() => {
                                                                setMedicationUse(false);
                                                                setMedicationNotes("");
                                                            }}
                                                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: !medicationUse ? colors.primaryBg : colors.secondaryBg, borderWidth: 1, borderColor: !medicationUse ? colors.primaryBg : colors.border }}
                                                        >
                                                            <Text style={{ color: !medicationUse ? colors.primaryText : colors.text, fontWeight: "700" }}>Não</Text>
                                                        </Pressable>
                                                        <Pressable
                                                            onPress={() => setMedicationUse(true)}
                                                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: medicationUse ? colors.primaryBg : colors.secondaryBg, borderWidth: 1, borderColor: medicationUse ? colors.primaryBg : colors.border }}
                                                        >
                                                            <Text style={{ color: medicationUse ? colors.primaryText : colors.text, fontWeight: "700" }}>Sim</Text>
                                                        </Pressable>
                                                    </View>
                                                    {medicationUse ? (
                                                        <TextInput
                                                            placeholder="Qual medicação?"
                                                            value={medicationNotes}
                                                            onChangeText={setMedicationNotes}
                                                            placeholderTextColor={colors.placeholder}
                                                            multiline
                                                            style={{ borderWidth: 1, borderColor: colors.border, padding: 10, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText, minHeight: 70, textAlignVertical: "top" }}
                                                        />
                                                    ) : null}
                                                </View>
                                            </View>
                                            <View style={{ gap: 6 }}>
                                                <Text style={{ color: colors.muted, fontSize: 11 }}>Observações</Text>
                                                <TextInput
                                                    placeholder="Outras observações"
                                                    value={healthObservations}
                                                    onChangeText={setHealthObservations}
                                                    placeholderTextColor={colors.placeholder}
                                                    multiline
                                                    style={{ borderWidth: 1, borderColor: colors.border, padding: 10, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText, minHeight: 80, textAlignVertical: "top" }}
                                                />
                                            </View>
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>

                            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
                                <Pressable
                                    onPress={() => toggleEditSection("guardian")}
                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
                                >
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Responsável</Text>
                                        <Text style={{ color: colors.muted, fontSize: 11 }}>{editGuardianSummary}</Text>
                                    </View>
                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: openEditSection === "guardian" ? "180deg" : "0deg" }] }} />
                                </Pressable>
                                {openEditSection === "guardian" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
                                {editGuardianAnim.isVisible ? (
                                    <Animated.View style={[editGuardianAnim.animatedStyle, { overflow: "hidden" }]}>
                                        <View style={{ gap: 10, padding: 12 }}>
                                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                                                <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                                                    <Text style={{ color: colors.muted, fontSize: 11 }}>Nome do responsável</Text>
                                                    <TextInput
                                                        placeholder="Nome do responsável"
                                                        value={guardianName}
                                                        onChangeText={setGuardianName}
                                                        placeholderTextColor={colors.placeholder}
                                                        style={{ borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 13, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }}
                                                    />
                                                </View>
                                                <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                                                    <Text style={{ color: colors.muted, fontSize: 11 }}>Telefone do responsável</Text>
                                                    <TextInput
                                                        placeholder="Telefone do responsável"
                                                        value={guardianPhone}
                                                        onChangeText={(value) => setGuardianPhone(formatPhone(value))}
                                                        keyboardType="phone-pad"
                                                        placeholderTextColor={colors.placeholder}
                                                        style={{ borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 13, borderRadius: 12, backgroundColor: colors.background, color: colors.inputText }}
                                                    />
                                                </View>
                                            </View>
                                            <View style={{ gap: 4 }}>
                                                <Text style={{ color: colors.muted, fontSize: 11 }}>Parentesco</Text>
                                                <View ref={editGuardianRelationTriggerRef}>
                                                    <Pressable onPress={() => toggleEditPicker("guardianRelation")} style={selectFieldStyle as StyleProp<ViewStyle>}>
                                                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>{guardianRelation || "Selecione"}</Text>
                                                        <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: showEditGuardianRelationPicker ? "180deg" : "0deg" }] }} />
                                                    </Pressable>
                                                </View>
                                                {showEditGuardianRelationPickerContent ? (
                                                    <Animated.View style={[editGuardianRelationPickerAnimStyle, { overflow: "hidden" }]}>
                                                        <View style={{ maxHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, overflow: "hidden" }}>
                                                            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ padding: 6, gap: 4 }}>
                                                                {guardianRelationOptions.map((item, index) => (
                                                                    <SelectOption key={item} label={item} value={item} active={item === guardianRelation} onSelect={handleSelectEditGuardianRelation} isFirst={index === 0} />
                                                                ))}
                                                            </ScrollView>
                                                        </View>
                                                    </Animated.View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>

                            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
                                <Pressable
                                    onPress={() => toggleEditSection("links")}
                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
                                >
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Turma e unidade</Text>
                                        <Text style={{ color: colors.muted, fontSize: 11 }}>{editLinksSummary}</Text>
                                    </View>
                                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: openEditSection === "links" ? "180deg" : "0deg" }] }} />
                                </Pressable>
                                {openEditSection === "links" ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
                                {editLinksAnim.isVisible ? (
                                    <Animated.View style={[editLinksAnim.animatedStyle, { overflow: "hidden" }]}>
                                        <View style={{ gap: 10, padding: 12 }}>
                                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                                                <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                                                    <Text style={{ color: colors.muted, fontSize: 11 }}>Unidade</Text>
                                                    <View ref={editUnitTriggerRef}>
                                                        <Pressable onPress={() => toggleEditPicker("unit")} style={selectFieldStyle as StyleProp<ViewStyle>}>
                                                            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>{selectedUnitFilterLabel}</Text>
                                                            <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: showEditUnitPicker ? "180deg" : "0deg" }] }} />
                                                        </Pressable>
                                                    </View>
                                                    {showEditUnitPickerContent ? (
                                                        <Animated.View style={[editUnitPickerAnimStyle, { overflow: "hidden" }]}>
                                                            <View
                                                                style={{
                                                                    maxHeight: 142,
                                                                    borderWidth: 1,
                                                                    borderColor: colors.border,
                                                                    borderRadius: 12,
                                                                    backgroundColor: colors.card,
                                                                    overflow: "hidden",
                                                                }}
                                                            >
                                                                <ScrollView
                                                                    nestedScrollEnabled
                                                                    showsVerticalScrollIndicator
                                                                    contentContainerStyle={{ padding: 6, gap: 4 }}
                                                                >
                                                                    {unitOptions.length ? (
                                                                        unitOptions.map((item, index) => (
                                                                            <StudentMultiSelectOption
                                                                                key={item}
                                                                                label={item}
                                                                                value={item}
                                                                                active={selectedUnitFilters.includes(item)}
                                                                                onToggle={handleToggleEditUnitFilter}
                                                                                isFirst={index === 0}
                                                                                compact
                                                                            />
                                                                        ))
                                                                    ) : (
                                                                        <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
                                                                            Nenhuma unidade cadastrada.
                                                                        </Text>
                                                                    )}
                                                                </ScrollView>
                                                            </View>
                                                        </Animated.View>
                                                    ) : null}
                                                </View>
                                                <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                                                    <Text style={{ color: colors.muted, fontSize: 11 }}>Turma</Text>
                                                    <View ref={editClassTriggerRef}>
                                                        <FormFieldValidationFeedback
                                                            message={validationIssue?.field === "unitClass" ? validationIssue.message : ""}
                                                            attempt={validationIssue?.field === "unitClass" ? validationIssue.attempt : 0}
                                                        >
                                                            <Pressable
                                                                onPress={() => toggleEditPicker("class")}
                                                                style={[
                                                                    selectFieldStyle as StyleProp<ViewStyle>,
                                                                    getValidationFieldStyle(validationIssue?.field === "unitClass", colors.dangerSolidBg),
                                                                ]}
                                                            >
                                                                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>{selectedClassName || "Selecione a turma"}</Text>
                                                                <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: showEditClassPicker ? "180deg" : "0deg" }] }} />
                                                            </Pressable>
                                                        </FormFieldValidationFeedback>
                                                    </View>
                                                    {showEditClassPickerContent ? (
                                                        <Animated.View style={[editClassPickerAnimStyle, { overflow: "hidden" }]}>
                                                            <View
                                                                style={{
                                                                    maxHeight: 104,
                                                                    borderWidth: 1,
                                                                    borderColor: colors.border,
                                                                    borderRadius: 12,
                                                                    backgroundColor: colors.card,
                                                                    overflow: "hidden",
                                                                }}
                                                            >
                                                                <ScrollView
                                                                    nestedScrollEnabled
                                                                    showsVerticalScrollIndicator
                                                                    contentContainerStyle={{ padding: 6, gap: 4 }}
                                                                >
                                                                    <StudentClassDropdownList
                                                                        colors={colors}
                                                                        classOptions={classOptions}
                                                                        filteredClassOptions={filteredClassOptions}
                                                                        selectedClassId={classId}
                                                                        onSelectClass={(value) => {
                                                                            onClearValidation?.("unitClass");
                                                                            handleSelectEditClass(value);
                                                                        }}
                                                                        compact
                                                                    />
                                                                </ScrollView>
                                                            </View>
                                                        </Animated.View>
                                                    ) : null}
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                                {selectedUnitFilters.length ? (
                                                    selectedUnitFilters.map((item) => (
                                                        <View key={item} style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
                                                            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>{item}</Text>
                                                        </View>
                                                    ))
                                                ) : (
                                                    <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
                                                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>Todas as unidades</Text>
                                                    </View>
                                                )}
                                                <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
                                                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>{selectedClassName || "Sem turma"}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>

                        </View>
                    </ScrollView>
                    <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Pressable
                            onPress={async () => {
                                setEditSaving(true);
                                try {
                                    const didSave = await onSave();
                                    if (didSave) closeEditModal();
                                } finally {
                                    setEditSaving(false);
                                }
                            }}
                            disabled={editSaving || !isEditDirty}
                            style={{
                                borderRadius: 12,
                                backgroundColor: colors.primaryBg,
                                paddingVertical: 11,
                                alignItems: "center",
                                opacity: editSaving ? 0.7 : !isEditDirty ? 0.45 : 1,
                            }}
                        >
                            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                                {editSaving ? "Salvando..." : "Salvar"}
                            </Text>
                        </Pressable>
                    </View>

                </View>
            </View>
        </ModalSheet>
        <StudentOperationalHistoryModal
            visible={showOperationalHistory}
            loading={operationalHistoryLoading}
            events={operationalHistory}
            errorMessage={operationalHistoryError}
            colors={colors}
            onClose={() => setShowOperationalHistory(false)}
            onRetry={() => void onRetryOperationalHistory()}
        />
        </>
    );
}
