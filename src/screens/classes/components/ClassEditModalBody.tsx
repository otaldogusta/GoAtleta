import { memo, type ReactNode, type RefObject, useRef, useState } from "react";

import { ActivityIndicator, Image, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";

import type { ClassStaffAssignment } from "../../../api/class-responsibles";
import type { OrgMember } from "../../../api/members";
import { type ClassGroup } from "../../../core/models";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { FadeHorizontalScroll } from "../../../ui/FadeHorizontalScroll";
import { useAppTheme } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { ClassUnitAutocomplete } from "./ClassUnitAutocomplete";

type PickerLayout = { x: number; y: number; width: number; height: number };
type WindowPosition = { x: number; y: number };
type SelectOptionValue = string | number;

type ColorOption = {
  key: string;
  label: string;
  palette: { bg: string; text: string };
};

type Option = { value: string; label: string };
type EditSection = "basics" | "team" | "agenda" | "profile" | "days" | "advanced";

const formatAnnualCycleLabel = (weeks: number) => {
  const months = Math.round((weeks / 52) * 12);
  const monthLabel = `${months} ${months === 1 ? "mês" : "meses"}`;
  return `${weeks} semanas (${monthLabel})`;
};

const formatModalityLabel = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return "Selecione";
  return `${trimmed.charAt(0).toLocaleUpperCase("pt-BR")}${trimmed.slice(1)}`;
};

type ClassEditModalBodyProps = {
  compact?: boolean;
  renderPickers?: boolean;
  leftColumnFooter?: ReactNode;
  editContainerRef: RefObject<View | null>;
  editAgeBandTriggerRef: RefObject<View | null>;
  editGenderTriggerRef: RefObject<View | null>;
  editGoalTriggerRef: RefObject<View | null>;
  editCycleLengthTriggerRef?: RefObject<View | null>;
  editMvLevelTriggerRef?: RefObject<View | null>;
  editModalityTriggerRef?: RefObject<View | null>;
  layouts: {
    editContainerWindow: WindowPosition | null;
    editAgeBandTriggerLayout: PickerLayout | null;
    editGenderTriggerLayout: PickerLayout | null;
    editGoalTriggerLayout: PickerLayout | null;
    editCycleLengthTriggerLayout?: PickerLayout | null;
    editMvLevelTriggerLayout?: PickerLayout | null;
    editModalityTriggerLayout?: PickerLayout | null;
  };
  pickers: {
    showEditAgeBandPicker: boolean;
    showEditGenderPicker: boolean;
    showEditGoalPicker: boolean;
    showEditAgeBandPickerContent: boolean;
    showEditGenderPickerContent: boolean;
    showEditGoalPickerContent: boolean;
    editAgeBandPickerAnimStyle: any;
    editGenderPickerAnimStyle: any;
    editGoalPickerAnimStyle: any;
    showEditCycleLengthPicker?: boolean;
    showEditMvLevelPicker?: boolean;
    showEditModalityPicker?: boolean;
    showEditCycleLengthPickerContent?: boolean;
    showEditMvLevelPickerContent?: boolean;
    showEditModalityPickerContent?: boolean;
    editCycleLengthPickerAnimStyle?: any;
    editMvLevelPickerAnimStyle?: any;
    editModalityPickerAnimStyle?: any;
    showEditCycleCalendar?: boolean;
  };
  fields: {
    editName: string;
    setEditName: (value: string) => void;
    editUnit: string;
    setEditUnit: (value: string) => void;
    editTrainingSpace: string;
    setEditTrainingSpace: (value: string) => void;
    editColorOptions: ColorOption[];
    editColorKey: string | null;
    handleSelectEditColor: (value: string | null) => void;
    editStartTime: string;
    setEditStartTime: (value: string) => void;
    normalizeTimeInput: (value: string) => string;
    editEndTime: string;
    setEditEndTime: (value: string) => void;
    editDuration: string;
    editCycleStartDate?: string;
    setEditCycleStartDate?: (value: string) => void;
    editCycleLengthWeeks?: number;
    editMvLevel?: string;
    editAgeBand: string;
    setEditAgeBand: (value: string) => void;
    editShowCustomAgeBand?: boolean;
    editCustomAgeBand?: string;
    setEditCustomAgeBand?: (value: string) => void;
    editGender: ClassGroup["gender"];
    editModality?: ClassGroup["modality"];
    editShowCustomGoal?: boolean;
    editGoal: string;
    editCustomGoal?: string;
    setEditCustomGoal?: (value: string) => void;
    setEditGoal?: (value: string) => void;
    editDays: number[];
    toggleEditDay: (value: number) => void;
    editFormError: string;
    editSaving: boolean;
    isEditDirty: boolean;
    editStaff?: ClassStaffAssignment[];
    editStaffCandidates?: OrgMember[];
    editStaffLoading?: boolean;
  };
  options: {
    dayNames: string[];
    ageBandOptions: string[];
    genderOptions: Option[];
    goalOptions: string[];
    customOptionLabel: string;
    cycleLengthOptions?: number[];
    modalityOptions?: Option[];
    mvLevelOptions?: Option[];
    trainingSpaceOptions?: string[];
    classNameOptions?: string[];
    unitOptions?: string[];
  };
  actions: {
    closeAllPickers: () => void;
    toggleEditPicker: (target: "cycle" | "level" | "age" | "gender" | "modality" | "goal") => void;
    handleEditSelectAgeBand: (value: SelectOptionValue) => void;
    handleEditSelectGender: (value: SelectOptionValue) => void;
    handleEditSelectGoal: (value: SelectOptionValue) => void;
    saveEditClass: () => void;
    handleDeleteClass: () => void;
    handleEditSelectCycleLength?: (value: SelectOptionValue) => void;
    handleEditSelectMvLevel?: (value: SelectOptionValue) => void;
    handleEditSelectModality?: (value: SelectOptionValue) => void;
    setShowEditCycleCalendar?: (value: boolean) => void;
    addEditStaff?: (member: OrgMember) => void;
    addPlaceholderEditStaff?: (displayName: string, role: ClassStaffAssignment["staffRole"]) => void;
    removeEditStaff?: (userId: string) => void;
    changeEditStaffRole?: (userId: string, role: ClassStaffAssignment["staffRole"]) => void;
  };
};

const EditSectionCard = memo(function EditSectionCard({
  section,
  title,
  summary,
  isOpen,
  onToggle,
  colors,
  children,
}: {
  section: EditSection;
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: (section: EditSection) => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
  children: ReactNode;
}) {
  const sectionCardStyle = getSectionCardStyle(colors, "neutral", {
    padding: 12,
    radius: 16,
    shadow: false,
  });

  return (
    <View style={sectionCardStyle}>
      <Pressable
        onPress={() => onToggle(section)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{summary}</Text>
        </View>
        <GoAtletaIcon
          name="chevronDown"
          size={16}
          color={colors.muted}
          style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {isOpen ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
      {isOpen ? <View style={{ gap: 12, padding: 12 }}>{children}</View> : null}
    </View>
  );
});
EditSectionCard.displayName = "EditSectionCard";

const SelectOption = memo(function SelectOptionItem({
  label,
  value,
  active,
  onSelect,
}: {
  label: string;
  value: SelectOptionValue;
  active: boolean;
  onSelect: (value: SelectOptionValue) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <AnchoredDropdownOption active={active} onPress={() => onSelect(value)}>
      <Text
        style={{
          color: active ? colors.primaryText : colors.text,
          fontSize: 14,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </AnchoredDropdownOption>
  );
});
SelectOption.displayName = "SelectOption";

function ClassEditModalBodyBase({
  compact = false,
  renderPickers = true,
  editContainerRef,
  editAgeBandTriggerRef,
  editGenderTriggerRef,
  editGoalTriggerRef,
  editCycleLengthTriggerRef,
  editMvLevelTriggerRef,
  editModalityTriggerRef,
  layouts,
  pickers,
  fields,
  options,
  actions,
}: ClassEditModalBodyProps) {
  const { colors } = useAppTheme();
  const selectFieldStyle = {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  };
  const [openSection, setOpenSection] = useState<EditSection | null>("basics");
  const handleToggleSection = (section: EditSection) => {
    actions.closeAllPickers();
    setOpenSection((current) => (current === section ? null : section));
  };

  const resolveGenderLabel = (value: ClassGroup["gender"] | "" | undefined) => {
    if (value === "feminino") return "Feminino";
    if (value === "masculino") return "Masculino";
    if (value === "misto") return "Misto";
    return "Selecione";
  };

  const resolveAgeBandLabel = () => {
    if (fields.editShowCustomAgeBand) {
      return fields.editCustomAgeBand?.trim() || "Personalizar";
    }
    return fields.editAgeBand?.trim() || "Selecione";
  };

  const hasAdvancedSection =
    !compact &&
    Boolean(
      fields.editModality !== undefined ||
        options.modalityOptions?.length
    );
  const staffRoleLabel: Record<ClassStaffAssignment["staffRole"], string> = {
    head: "Professor responsável",
    assistant: "Auxiliar",
    intern: "Estagiário(a)",
  };
  const staff = [...(fields.editStaff ?? [])].sort(
    (left, right) => ["head", "assistant", "intern"].indexOf(left.staffRole) - ["head", "assistant", "intern"].indexOf(right.staffRole)
  );
  const teamSummary = fields.editStaffLoading
    ? "Carregando equipe"
    : staff.length
      ? staff.map((member) => staffRoleLabel[member.staffRole]).join(" • ")
      : "Nenhum profissional vinculado";

  const renderColorOption = (option: ColorOption, index: number) => {
    const value = option.key === "default" ? null : option.key;
    const active = (fields.editColorKey ?? null) === value;
    return (
      <Pressable
        key={option.key}
        onPress={() => fields.handleSelectEditColor(value)}
        style={{
          alignItems: "center",
          gap: 4,
          marginLeft: index === 0 ? 6 : 0,
          marginRight: 2,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            backgroundColor: option.palette.bg,
            borderWidth: active ? 3 : 1,
            borderColor: active ? colors.text : colors.border,
          }}
        />
      </Pressable>
    );
  };

  return (
    <>
      <View style={{ position: "relative", gap: 12 }}>
        <EditSectionCard
          section="basics"
          title="Dados básicos"
          summary={`${fields.editName || "Sem nome"} • ${fields.editUnit || "Sem unidade"}`}
          isOpen={openSection === "basics"}
          onToggle={handleToggleSection}
          colors={colors}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Nome da turma</Text>
              <TextInput
                placeholder="Nome da turma"
                value={fields.editName}
                onChangeText={fields.setEditName}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  color: colors.inputText,
                  fontSize: 13,
                }}
              />
            </View>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Unidade</Text>
              <TextInput
                placeholder="Unidade"
                value={fields.editUnit}
                onChangeText={fields.setEditUnit}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  color: colors.inputText,
                  fontSize: 13,
                }}
              />
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Cor da turma</Text>
            <FadeHorizontalScroll
              containerStyle={{}}
              scrollStyle={{}}
              fadeColor={colors.card}
              fadeWidth={36}
              contentContainerStyle={{ flexDirection: "row", gap: 8 }}
            >
              {fields.editColorOptions.map((option, index) => renderColorOption(option, index))}
            </FadeHorizontalScroll>
          </View>
        </EditSectionCard>

        <EditSectionCard
          section="team"
          title="Equipe responsável"
          summary={teamSummary}
          isOpen={openSection === "team"}
          onToggle={handleToggleSection}
          colors={colors}
        >
          {fields.editStaffLoading ? (
            <View style={{ minHeight: 52, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : staff.length ? (
            <View style={{ gap: 8 }}>
              {staff.map((member) => (
                <View
                  key={`${member.userId}-${member.staffRole}`}
                  style={{
                    minHeight: 50,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                      {member.displayName?.trim() || staffRoleLabel[member.staffRole]}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {staffRoleLabel[member.staffRole]}
                    </Text>
                  </View>
                  <GoAtletaIcon name="profile" size={18} color={colors.muted} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Nenhum professor, auxiliar ou estagiário está vinculado a esta turma.
            </Text>
          )}
        </EditSectionCard>

        <EditSectionCard
          section="agenda"
          title="Agenda"
          summary={`${fields.editStartTime || "--:--"} • ${fields.editEndTime || "--:--"}${fields.editTrainingSpace ? ` • ${fields.editTrainingSpace}` : ""}`}
          isOpen={openSection === "agenda"}
          onToggle={handleToggleSection}
          colors={colors}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Horário</Text>
              <TextInput
                placeholder="Horário (HH:MM)"
                value={fields.editStartTime}
                onChangeText={(value) => fields.setEditStartTime(fields.normalizeTimeInput(value))}
                keyboardType="numeric"
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  color: colors.inputText,
                  fontSize: 13,
                }}
              />
            </View>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Horário de término</Text>
              <TextInput
                placeholder="HH:MM"
                value={fields.editEndTime}
                onChangeText={(value) => fields.setEditEndTime(fields.normalizeTimeInput(value))}
                keyboardType="numeric"
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  color: colors.inputText,
                  fontSize: 13,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {fields.editDuration ? `Duração automática: ${fields.editDuration} min` : "A duração será calculada automaticamente."}
              </Text>
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <ClassUnitAutocomplete colors={colors} value={fields.editTrainingSpace} units={options.trainingSpaceOptions ?? []} onChangeText={fields.setEditTrainingSpace} label="Quadra / espaço" placeholder="Pesquisar ou cadastrar espaço" showValueAsBadge />
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              Turmas só conflitam quando usam a mesma quadra ou quando o espaço não foi informado.
            </Text>
          </View>
        </EditSectionCard>

        <EditSectionCard
          section="profile"
          title="Perfil esportivo"
          summary={`${resolveAgeBandLabel()} • ${resolveGenderLabel(fields.editGender)}`}
          isOpen={openSection === "profile"}
          onToggle={handleToggleSection}
          colors={colors}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Faixa etária</Text>
              <View ref={editAgeBandTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("age")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {resolveAgeBandLabel()}
                  </Text>
                  <GoAtletaIcon
                    name="chevronDown"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: pickers.showEditAgeBandPicker ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
              </View>
              {fields.editShowCustomAgeBand ? (
                <TextInput
                  placeholder="Personalizar faixa etária"
                  value={fields.editCustomAgeBand ?? ""}
                  onChangeText={(value) => {
                    fields.setEditCustomAgeBand?.(value);
                    fields.setEditAgeBand?.(value);
                  }}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    color: colors.inputText,
                    fontSize: 13,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Gênero</Text>
              <View ref={editGenderTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("gender")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {resolveGenderLabel(fields.editGender)}
                  </Text>
                  <GoAtletaIcon
                    name="chevronDown"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: pickers.showEditGenderPicker ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
              </View>
            </View>
          </View>

        </EditSectionCard>

        {hasAdvancedSection ? (
          <EditSectionCard
            section="advanced"
            title="Modalidade"
            summary="Configuração esportiva da turma"
            isOpen={openSection === "advanced"}
            onToggle={handleToggleSection}
            colors={colors}
          >
            {fields.editModality !== undefined && actions.handleEditSelectModality && options.modalityOptions?.length ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Modalidade</Text>
                <View ref={editModalityTriggerRef}>
                  <Pressable onPress={() => actions.toggleEditPicker("modality")} style={selectFieldStyle}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {formatModalityLabel(options.modalityOptions?.find((option) => option.value === fields.editModality)?.label ?? fields.editModality)}
                    </Text>
                    <GoAtletaIcon
                      name="chevronDown"
                      size={16}
                      color={colors.muted}
                      style={{ transform: [{ rotate: pickers.showEditModalityPicker ? "180deg" : "0deg" }] }}
                    />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </EditSectionCard>
        ) : null}

        <EditSectionCard
          section="days"
          title="Dias da semana"
          summary={`${fields.editDays.length} selecionados`}
          isOpen={openSection === "days"}
          onToggle={handleToggleSection}
          colors={colors}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {options.dayNames.map((label, index) => {
              const active = fields.editDays.includes(index);
              return (
                <Pressable key={label} onPress={() => fields.toggleEditDay(index)} style={getChipStyle(active, colors)}>
                  <Text style={getChipTextStyle(active, colors)}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {fields.editFormError ? <Text style={{ color: colors.dangerText, fontSize: 12 }}>{fields.editFormError}</Text> : null}
        </EditSectionCard>
      </View>
      {renderPickers ? (
        <ClassEditModalPickers
          editContainerRef={editContainerRef}
          editAgeBandTriggerRef={editAgeBandTriggerRef}
          editGenderTriggerRef={editGenderTriggerRef}
          editGoalTriggerRef={editGoalTriggerRef}
          editCycleLengthTriggerRef={editCycleLengthTriggerRef}
          editMvLevelTriggerRef={editMvLevelTriggerRef}
          editModalityTriggerRef={editModalityTriggerRef}
          layouts={layouts}
          pickers={pickers}
          fields={fields}
          options={options}
          actions={actions}
        />
      ) : null}
    </>
  );
}

function ClassEditModalPickersBase({
  editAgeBandTriggerRef,
  editGenderTriggerRef,
  editGoalTriggerRef,
  editCycleLengthTriggerRef,
  editMvLevelTriggerRef,
  editModalityTriggerRef,
  layouts,
  pickers,
  fields,
  options,
  actions,
}: ClassEditModalBodyProps) {
  const showEditCycleLengthPickerContent = Boolean(pickers.showEditCycleLengthPickerContent);
  const showEditMvLevelPickerContent = Boolean(pickers.showEditMvLevelPickerContent);
  const showEditModalityPickerContent = Boolean(pickers.showEditModalityPickerContent);
  const editCycleLengthTriggerLayout = layouts.editCycleLengthTriggerLayout ?? null;
  const editMvLevelTriggerLayout = layouts.editMvLevelTriggerLayout ?? null;
  const editModalityTriggerLayout = layouts.editModalityTriggerLayout ?? null;

  return (
    <>
      <AnchoredDropdown
        visible={showEditCycleLengthPickerContent}
        layout={editCycleLengthTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editCycleLengthPickerAnimStyle}
        zIndex={5200}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        interactiveRefs={editCycleLengthTriggerRef ? [editCycleLengthTriggerRef] : undefined}
      >
        <View style={{ gap: 6 }}>
          {(options.cycleLengthOptions ?? []).map((option) => (
            <SelectOption
              key={option}
              label={formatAnnualCycleLabel(option)}
              value={option}
              active={fields.editCycleLengthWeeks === option}
              onSelect={actions.handleEditSelectCycleLength!}
            />
          ))}
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={showEditMvLevelPickerContent}
        layout={editMvLevelTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editMvLevelPickerAnimStyle}
        zIndex={5201}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        interactiveRefs={editMvLevelTriggerRef ? [editMvLevelTriggerRef] : undefined}
      >
        <View style={{ gap: 6 }}>
          {(options.mvLevelOptions ?? []).map((option) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={fields.editMvLevel === option.value}
              onSelect={actions.handleEditSelectMvLevel!}
            />
          ))}
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={pickers.showEditAgeBandPickerContent}
        layout={layouts.editAgeBandTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editAgeBandPickerAnimStyle}
        zIndex={5202}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        interactiveRefs={[editAgeBandTriggerRef]}
      >
        <View style={{ gap: 6 }}>
          {options.ageBandOptions.map((option) => (
            <SelectOption
              key={option}
              label={option}
              value={option}
              active={!fields.editShowCustomAgeBand && fields.editAgeBand === option}
              onSelect={actions.handleEditSelectAgeBand}
            />
          ))}
          <SelectOption
            label={options.customOptionLabel}
            value={options.customOptionLabel}
            active={Boolean(fields.editShowCustomAgeBand)}
            onSelect={actions.handleEditSelectAgeBand}
          />
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={pickers.showEditGenderPickerContent}
        layout={layouts.editGenderTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editGenderPickerAnimStyle}
        zIndex={5203}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        interactiveRefs={[editGenderTriggerRef]}
      >
        <View style={{ gap: 6 }}>
          {options.genderOptions.map((option) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={fields.editGender === option.value}
              onSelect={actions.handleEditSelectGender}
            />
          ))}
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={showEditModalityPickerContent}
        layout={editModalityTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editModalityPickerAnimStyle}
        zIndex={5204}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        interactiveRefs={editModalityTriggerRef ? [editModalityTriggerRef] : undefined}
      >
        <View style={{ gap: 6 }}>
          {(options.modalityOptions ?? []).map((option) => (
            <SelectOption
              key={option.value}
              label={formatModalityLabel(option.label)}
              value={option.value}
              active={fields.editModality === option.value}
              onSelect={actions.handleEditSelectModality!}
            />
          ))}
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={pickers.showEditGoalPickerContent}
        layout={layouts.editGoalTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editGoalPickerAnimStyle}
        zIndex={5205}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        interactiveRefs={[editGoalTriggerRef]}
      >
        <View style={{ gap: 6 }}>
          {options.goalOptions.map((goal) => (
            <SelectOption
              key={goal}
              label={goal}
              value={goal}
              active={!fields.editShowCustomGoal && fields.editGoal === goal}
              onSelect={actions.handleEditSelectGoal}
            />
          ))}
          <SelectOption
            label={options.customOptionLabel}
            value={options.customOptionLabel}
            active={Boolean(fields.editShowCustomGoal)}
            onSelect={actions.handleEditSelectGoal}
          />
        </View>
      </AnchoredDropdown>
    </>
  );
}

function ModernClassEditModalBodyBase(props: ClassEditModalBodyProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const stacked = width < 820;
  const { fields, options, actions, pickers } = props;
  const [staffSearch, setStaffSearch] = useState("");
  const [roleMenuUserId, setRoleMenuUserId] = useState<string | null>(null);
  const [roleMenuLayout, setRoleMenuLayout] = useState<PickerLayout | null>(null);
  const roleTriggerRefs = useRef(new Map<string, View | null>());
  const [showPlaceholderStaffForm, setShowPlaceholderStaffForm] = useState(false);
  const [placeholderStaffRole, setPlaceholderStaffRole] = useState<ClassStaffAssignment["staffRole"]>("assistant");
  const [showPlaceholderRoleOptions, setShowPlaceholderRoleOptions] = useState(false);
  const [showColorOptions, setShowColorOptions] = useState(false);
  const [colorMenuLayout, setColorMenuLayout] = useState<PickerLayout | null>(null);
  const colorTriggerRef = useRef<View | null>(null);
  const staffRoleLabel: Record<ClassStaffAssignment["staffRole"], string> = {
    head: "Professor responsável",
    assistant: "Auxiliar",
    intern: "Estagiário(a)",
  };
  const staff = [...(fields.editStaff ?? [])].sort(
    (left, right) => ["head", "assistant", "intern"].indexOf(left.staffRole) - ["head", "assistant", "intern"].indexOf(right.staffRole)
  );
  const staffUserIds = new Set(staff.map((member) => member.userId));
  const normalizedStaffSearch = staffSearch.trim().toLocaleLowerCase("pt-BR");
  const staffCandidates = (fields.editStaffCandidates ?? [])
    .filter((member) => !staffUserIds.has(member.userId))
    .filter((member) => !normalizedStaffSearch || `${member.displayName} ${member.email ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedStaffSearch))
    .slice(0, 6);
  const selectedColorOption = fields.editColorOptions.find((option) => {
    const value = option.key === "default" ? null : option.key;
    return (fields.editColorKey ?? null) === value;
  }) ?? fields.editColorOptions[0];
  const orderedColorOptions = selectedColorOption
    ? [selectedColorOption, ...fields.editColorOptions.filter((option) => option.key !== selectedColorOption.key)]
    : fields.editColorOptions;
  const toggleColorMenu = () => {
    if (showColorOptions) {
      setShowColorOptions(false);
      return;
    }
    colorTriggerRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      if (measuredWidth <= 0 || measuredHeight <= 0) return;
      setColorMenuLayout({ x, y, width: measuredWidth, height: measuredHeight });
      setShowColorOptions(true);
    });
  };
  const activeRoleMember = staff.find((member) => member.userId === roleMenuUserId) ?? null;
  const toggleRoleMenu = (userId: string) => {
    if (roleMenuUserId === userId) {
      setRoleMenuUserId(null);
      setRoleMenuLayout(null);
      return;
    }
    roleTriggerRefs.current.get(userId)?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      if (measuredWidth <= 0 || measuredHeight <= 0) return;
      setRoleMenuLayout({ x, y, width: measuredWidth, height: measuredHeight });
      setRoleMenuUserId(userId);
    });
  };
  const fieldStyle = {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    color: colors.inputText,
    fontSize: 14,
  } as const;
  const selectStyle = {
    ...fieldStyle,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  };
  const sectionTitleStyle = { color: colors.text, fontSize: 18, fontWeight: "800" as const };
  const labelStyle = { color: colors.muted, fontSize: 12, fontWeight: "500" as const };
  const resolveGenderLabel = () => {
    if (fields.editGender === "feminino") return "Feminino";
    if (fields.editGender === "masculino") return "Masculino";
    if (fields.editGender === "misto") return "Misto";
    return "Selecione";
  };
  const resolveAgeBandLabel = () => fields.editShowCustomAgeBand
    ? fields.editCustomAgeBand?.trim() || "Personalizar"
    : fields.editAgeBand?.trim() || "Selecione";

  const renderSelect = ({
    label,
    value,
    triggerRef,
    target,
    open,
    fill = true,
  }: {
    label: string;
    value: string;
    triggerRef?: RefObject<View | null>;
    target: "cycle" | "level" | "age" | "gender" | "modality" | "goal";
    open: boolean;
    fill?: boolean;
  }) => (
    <View style={{ flex: fill ? 1 : undefined, width: fill ? undefined : "100%", minWidth: stacked ? "100%" : 170, gap: 6 }}>
      <Text style={labelStyle}>{label}</Text>
      <View ref={triggerRef}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => actions.toggleEditPicker(target)} style={selectStyle}>
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" }}>{value}</Text>
          <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <View style={{ gap: stacked ? 22 : 28 }}>
        <View style={{ flexDirection: stacked ? "column" : "row", gap: stacked ? 22 : 28 }}>
          <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Text style={sectionTitleStyle}>Identificação</Text>
              {fields.isEditDirty ? <View accessibilityLabel="Seção alterada" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.successText }} /> : null}
            </View>

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
                <View style={{ width: 72, gap: 4 }}>
                  <Text style={labelStyle}>Cor</Text>
                  <View ref={colorTriggerRef} collapsable={false}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Cor da turma: ${selectedColorOption?.label ?? "Padrão"}`} accessibilityState={{ expanded: showColorOptions }} onPress={toggleColorMenu} style={[selectStyle, { height: 50, minHeight: 50, paddingHorizontal: 9 }]}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: selectedColorOption?.palette.bg ?? colors.inputBg }} />
                      <GoAtletaIcon name="chevronDown" size={14} color={colors.muted} style={{ transform: [{ rotate: showColorOptions ? "180deg" : "0deg" }] }} />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ClassUnitAutocomplete colors={colors} value={fields.editName} units={options.classNameOptions ?? []} onChangeText={fields.setEditName} label="Nome da turma" placeholder="Digite para buscar ou criar" />
                </View>
              </View>
              <AnchoredDropdown visible={showColorOptions && Boolean(colorMenuLayout)} layout={colorMenuLayout} container={null} animationStyle={{ opacity: 1 }} zIndex={9800} maxHeight={320} nestedScrollEnabled portalToBodyOnWeb fitContent preferredWidth={colorMenuLayout?.width} density="menu" onRequestClose={() => setShowColorOptions(false)} interactiveRefs={[colorTriggerRef]}>
                {orderedColorOptions.map((option) => {
                  const value = option.key === "default" ? null : option.key;
                  const active = (fields.editColorKey ?? null) === value;
                  return (
                    <AnchoredDropdownOption
                      key={option.key}
                      active={active}
                      density="compact"
                      onPress={() => { fields.handleSelectEditColor(value); setShowColorOptions(false); }}
                      style={{ minHeight: 42, justifyContent: "center", backgroundColor: colors.card, borderColor: colors.border }}
                    >
                      <View accessibilityLabel={option.label} style={{ alignItems: "center" }}>
                        <View style={{ padding: 3, borderRadius: 17, borderWidth: 2, borderColor: active ? colors.text : "transparent" }}>
                          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: option.palette.bg }} />
                        </View>
                      </View>
                    </AnchoredDropdownOption>
                  );
                })}
              </AnchoredDropdown>
            </View>
            <ClassUnitAutocomplete colors={colors} value={fields.editUnit} units={options.unitOptions ?? []} onChangeText={fields.setEditUnit} label="Unidade" placeholder="Digite para buscar ou criar" />
            <ClassUnitAutocomplete colors={colors} value={fields.editTrainingSpace} units={options.trainingSpaceOptions ?? []} onChangeText={fields.setEditTrainingSpace} label="Quadra / espaço" placeholder="Pesquisar ou cadastrar espaço" showValueAsBadge />
            {fields.editModality !== undefined && options.modalityOptions?.length ? renderSelect({
              label: "Modalidade",
              value: formatModalityLabel(options.modalityOptions.find((option) => option.value === fields.editModality)?.label ?? fields.editModality),
              triggerRef: props.editModalityTriggerRef,
              target: "modality",
              open: Boolean(pickers.showEditModalityPicker),
              fill: false,
            }) : null}
            <View style={{ height: 1, marginVertical: 2, backgroundColor: colors.border }} />
            <View style={{ gap: 12 }}>
              <Text style={sectionTitleStyle}>Perfil esportivo</Text>
              <View style={{ flexDirection: stacked ? "column" : "row", flexWrap: "wrap", gap: 10 }}>
                {renderSelect({ label: "Faixa etária", value: resolveAgeBandLabel(), triggerRef: props.editAgeBandTriggerRef, target: "age", open: pickers.showEditAgeBandPicker })}
                {renderSelect({ label: "Categoria", value: resolveGenderLabel(), triggerRef: props.editGenderTriggerRef, target: "gender", open: pickers.showEditGenderPicker })}
                {fields.editMvLevel !== undefined && options.mvLevelOptions?.length ? renderSelect({ label: "Nível", value: options.mvLevelOptions.find((option) => option.value === fields.editMvLevel)?.label || "Selecione", triggerRef: props.editMvLevelTriggerRef, target: "level", open: Boolean(pickers.showEditMvLevelPicker) }) : null}
              </View>
              {fields.editShowCustomAgeBand ? <TextInput accessibilityLabel="Faixa etária personalizada" value={fields.editCustomAgeBand ?? ""} onChangeText={(value) => { fields.setEditCustomAgeBand?.(value); fields.setEditAgeBand(value); }} placeholder="Personalizar faixa etária" placeholderTextColor={colors.placeholder} style={fieldStyle} /> : null}
              {fields.editFormError ? <Text style={{ color: colors.dangerText, fontSize: 12 }}>{fields.editFormError}</Text> : null}
            </View>
            {props.leftColumnFooter}
          </View>

          {!stacked ? <View style={{ width: 1, backgroundColor: colors.border }} /> : null}

          <View style={{ flex: stacked ? undefined : 1.14, minWidth: 0, gap: 16 }}>
            <Text style={sectionTitleStyle}>Organização</Text>
            <View style={{ gap: 8 }}>
              <Text style={[labelStyle, { color: colors.text, fontSize: 13, fontWeight: "700" }]}>Equipe responsável</Text>
              <View style={{ position: "relative" }}>
                <View style={[selectStyle, { justifyContent: "flex-start" }]}>
                  <GoAtletaIcon name="search" size={18} color={colors.muted} />
                  <TextInput accessibilityLabel="Buscar pessoa para adicionar" value={staffSearch} onChangeText={setStaffSearch} placeholder="Buscar pessoa para adicionar..." placeholderTextColor={colors.placeholder} style={{ flex: 1, minWidth: 0, color: colors.inputText, fontSize: 13, paddingVertical: 0 }} />
                </View>
                {staffSearch.trim() ? (
                  <View style={{ marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, padding: 5, gap: 3 }}>
                    {staffCandidates.length ? staffCandidates.map((candidate) => (
                      <Pressable key={candidate.userId} accessibilityRole="button" onPress={() => { actions.addEditStaff?.(candidate); setStaffSearch(""); }} style={{ minHeight: 42, borderRadius: 9, paddingHorizontal: 10, justifyContent: "center" }}>
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{candidate.displayName}</Text>
                        {candidate.email ? <Text style={{ color: colors.muted, fontSize: 10 }}>{candidate.email}</Text> : null}
                      </Pressable>
                    )) : (
                      <View style={{ padding: 6, gap: 8 }}>
                        <Text style={{ color: colors.muted, fontSize: 11, paddingHorizontal: 4 }}>Nenhuma pessoa cadastrada com esse nome.</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Pré-cadastrar ${staffSearch.trim()} sem e-mail`} onPress={() => setShowPlaceholderStaffForm(true)} style={{ minHeight: 42, borderRadius: 9, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.secondaryBg }}>
                          <GoAtletaIcon name="add" size={17} color={colors.text} />
                          <Text style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: "700" }}>Pré-cadastrar “{staffSearch.trim()}”</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ) : null}
                {showPlaceholderStaffForm && staffSearch.trim() ? (
                  <View style={{ marginTop: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" }}>{staffSearch.trim()}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Função: ${staffRoleLabel[placeholderStaffRole]}`} accessibilityState={{ expanded: showPlaceholderRoleOptions }} onPress={() => setShowPlaceholderRoleOptions((current) => !current)} style={{ minHeight: 34, borderRadius: 999, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.secondaryBg }}>
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>{staffRoleLabel[placeholderStaffRole]}</Text>
                        <GoAtletaIcon name="chevronDown" size={13} color={colors.muted} style={{ transform: [{ rotate: showPlaceholderRoleOptions ? "180deg" : "0deg" }] }} />
                      </Pressable>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>Sem conta e sem acesso ao aplicativo.</Text>
                    {showPlaceholderRoleOptions ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {(["head", "assistant", "intern"] as const).map((role) => {
                        const active = placeholderStaffRole === role;
                        return <Pressable key={role} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { setPlaceholderStaffRole(role); setShowPlaceholderRoleOptions(false); }} style={[getChipStyle(active, colors), { borderRadius: 999 }]}><Text style={getChipTextStyle(active, colors)}>{staffRoleLabel[role]}</Text></Pressable>;
                      })}
                    </View> : null}
                    {placeholderStaffRole === "head" && staff.some((member) => member.staffRole === "head") ? <Text style={{ color: colors.warningText ?? colors.text, fontSize: 10, fontWeight: "600" }}>O responsável atual passará para Auxiliar após sua confirmação.</Text> : null}
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                      <Pressable accessibilityRole="button" onPress={() => { setShowPlaceholderStaffForm(false); setShowPlaceholderRoleOptions(false); }} style={{ minHeight: 40, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Cancelar</Text></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Adicionar profissional sem e-mail" onPress={() => { actions.addPlaceholderEditStaff?.(staffSearch.trim(), placeholderStaffRole); setStaffSearch(""); setShowPlaceholderStaffForm(false); setShowPlaceholderRoleOptions(false); setPlaceholderStaffRole("assistant"); }} style={{ minHeight: 40, borderRadius: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryBg }}><Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>Adicionar</Text></Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
              {fields.editStaffLoading ? (
                <View style={{ minHeight: 74, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.text} /></View>
              ) : staff.length ? staff.map((member) => {
                const displayName = member.displayName?.trim() || staffRoleLabel[member.staffRole];
                const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
                return (
                  <View key={member.userId} style={{ position: "relative" }}>
                    <View style={{ minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      {member.photoUrl ? <Image source={{ uri: member.photoUrl }} style={{ width: 38, height: 38, borderRadius: 19 }} /> : <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.muted, fontWeight: "800", fontSize: 12 }}>{initials || "—"}</Text></View>}
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{displayName}</Text>
                        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>{staffRoleLabel[member.staffRole]}{member.isPlaceholder ? " · sem acesso ao app" : ""}</Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${displayName} da equipe`} onPress={() => actions.removeEditStaff?.(member.userId)} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                        <GoAtletaIcon name="close" size={18} color={colors.muted} />
                      </Pressable>
                      <View ref={(node) => { roleTriggerRefs.current.set(member.userId, node); }}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Alterar função de ${displayName}`} onPress={() => toggleRoleMenu(member.userId)} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                          <GoAtletaIcon name="chevronDown" size={17} color={colors.muted} style={{ transform: [{ rotate: roleMenuUserId === member.userId ? "180deg" : "0deg" }] }} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              }) : <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhum profissional vinculado.</Text>}
              <AnchoredDropdown
                visible={Boolean(activeRoleMember && roleMenuLayout)}
                layout={roleMenuLayout}
                container={null}
                animationStyle={{ opacity: 1 }}
                zIndex={9800}
                maxHeight={180}
                nestedScrollEnabled
                portalToBodyOnWeb
                fitContent
                preferredWidth={220}
                density="menu"
                onRequestClose={() => { setRoleMenuUserId(null); setRoleMenuLayout(null); }}
              >
                {activeRoleMember ? (["head", "assistant", "intern"] as const).map((role) => (
                  <AnchoredDropdownOption
                    key={role}
                    active={activeRoleMember.staffRole === role}
                    density="compact"
                    onPress={() => {
                      actions.changeEditStaffRole?.(activeRoleMember.userId, role);
                      setRoleMenuUserId(null);
                      setRoleMenuLayout(null);
                    }}
                  >
                    <Text style={{ flex: 1, color: activeRoleMember.staffRole === role ? colors.primaryText : colors.text, fontSize: 12, fontWeight: activeRoleMember.staffRole === role ? "700" : "500" }}>{staffRoleLabel[role]}</Text>
                  </AnchoredDropdownOption>
                )) : null}
              </AnchoredDropdown>
            </View>

            <View style={{ gap: 10 }}>
              <View style={{ gap: 2 }}>
                <Text style={labelStyle}>Agenda</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>Mesmo intervalo para todos os dias ativos.</Text>
              </View>
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" }}>
                {[1, 2, 3, 4, 5, 6, 0].map((index, position) => {
                  const label = options.dayNames[index] ?? "";
                  const active = fields.editDays.includes(index);
                  const timeSurfaceStyle = {
                    flex: 1,
                    minWidth: 0,
                    minHeight: 44,
                    borderRadius: 10,
                    backgroundColor: colors.inputBg,
                    paddingHorizontal: stacked ? 8 : 11,
                    flexDirection: "row" as const,
                    alignItems: "center" as const,
                    gap: stacked ? 4 : 7,
                    opacity: active ? 1 : 0.65,
                  };
                  return (
                    <View
                      key={`${index}-${label}`}
                      style={{
                        paddingHorizontal: stacked ? 8 : 12,
                        paddingVertical: 10,
                        gap: stacked ? 6 : 9,
                        flexDirection: "row",
                        alignItems: "center",
                        borderTopWidth: position === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ width: stacked ? 82 : 112, flexDirection: "row", alignItems: "center", gap: stacked ? 6 : 10 }}>
                        <Pressable
                          accessibilityRole="switch"
                          accessibilityLabel={`${label}: ${active ? "com aula" : "sem aula"}`}
                          accessibilityState={{ checked: active }}
                          onPress={() => fields.toggleEditDay(index)}
                          style={{
                            width: 38,
                            height: 22,
                            borderRadius: 11,
                            padding: 2,
                            justifyContent: "center",
                            backgroundColor: active ? colors.text : colors.border,
                          }}
                        >
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              alignSelf: active ? "flex-end" : "flex-start",
                              backgroundColor: colors.card,
                            }}
                          />
                        </Pressable>
                        <Text style={{ flex: 1, color: active ? colors.text : colors.muted, fontSize: 13, fontWeight: active ? "700" : "500" }}>{label}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", gap: stacked ? 5 : 8 }}>
                        <View style={timeSurfaceStyle}>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>De</Text>
                          {active ? (
                            <TextInput
                              accessibilityLabel={`Horário de início de ${label}`}
                              value={fields.editStartTime}
                              onChangeText={(value) => fields.setEditStartTime(fields.normalizeTimeInput(value))}
                              keyboardType="numeric"
                              placeholder="09:00"
                              placeholderTextColor={colors.placeholder}
                              style={{ flex: 1, minWidth: 0, paddingVertical: 0, color: colors.inputText, fontSize: 13, fontWeight: "600", borderRadius: 0 }}
                            />
                          ) : <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: stacked ? 10 : 12, textAlign: "right" }}>Sem aula</Text>}
                        </View>
                        <View style={timeSurfaceStyle}>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>Até</Text>
                          {active ? (
                            <TextInput
                              accessibilityLabel={`Horário de término de ${label}`}
                              value={fields.editEndTime}
                              onChangeText={(value) => fields.setEditEndTime(fields.normalizeTimeInput(value))}
                              keyboardType="numeric"
                              placeholder="10:00"
                              placeholderTextColor={colors.placeholder}
                              style={{ flex: 1, minWidth: 0, paddingVertical: 0, color: colors.inputText, fontSize: 13, fontWeight: "600", borderRadius: 0 }}
                            />
                          ) : <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: stacked ? 10 : 12, textAlign: "right" }}>Sem aula</Text>}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

      </View>

      {props.renderPickers ? <ClassEditModalPickers {...props} /> : null}
    </>
  );
}

export const ClassEditModalPickers = memo(ClassEditModalPickersBase);
ClassEditModalPickers.displayName = "ClassEditModalPickers";

function getChipStyle(
  active: boolean,
  colors: ReturnType<typeof useAppTheme>["colors"]
) {
  return {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
  };
}

function getChipTextStyle(
  active: boolean,
  colors: ReturnType<typeof useAppTheme>["colors"]
) {
  return {
    color: active ? colors.primaryText : colors.text,
    fontWeight: "600" as const,
    fontSize: 12,
  };
}

export const ClassEditModalBody = memo(ClassEditModalBodyBase);
ClassEditModalBody.displayName = "ClassEditModalBody";

export const ModernClassEditModalBody = memo(ModernClassEditModalBodyBase);
ModernClassEditModalBody.displayName = "ModernClassEditModalBody";
