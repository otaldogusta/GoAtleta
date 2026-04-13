import { memo, type ReactNode, type RefObject, useState } from "react";

import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput, View } from "react-native";

import { type ClassGroup } from "../../../core/models";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { DateInput } from "../../../ui/DateInput";
import { FadeHorizontalScroll } from "../../../ui/FadeHorizontalScroll";
import { useAppTheme } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";

type PickerLayout = { x: number; y: number; width: number; height: number };
type WindowPosition = { x: number; y: number };
type SelectOptionValue = string | number;

type ColorOption = {
  key: string;
  label: string;
  palette: { bg: string; text: string };
};

type Option = { value: string; label: string };
type EditSection = "basics" | "agenda" | "profile" | "days" | "advanced";

const formatAnnualCycleLabel = (weeks: number) => {
  const months = Math.round((weeks / 52) * 12);
  const monthLabel = `${months} ${months === 1 ? "mês" : "meses"}`;
  return `${weeks} semanas (${monthLabel})`;
};

type ClassEditModalBodyProps = {
  compact?: boolean;
  renderPickers?: boolean;
  refs: {
    editContainerRef: RefObject<View | null>;
    editAgeBandTriggerRef: RefObject<View | null>;
    editGenderTriggerRef: RefObject<View | null>;
    editGoalTriggerRef: RefObject<View | null>;
    editCycleLengthTriggerRef?: RefObject<View | null>;
    editMvLevelTriggerRef?: RefObject<View | null>;
    editModalityTriggerRef?: RefObject<View | null>;
  };
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
        <Ionicons
          name="chevron-down"
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
  refs,
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

  const resolveGoalLabel = () => {
    if (fields.editShowCustomGoal) {
      return fields.editCustomGoal?.trim() || "Personalizar";
    }
    return fields.editGoal?.trim() || "Selecione";
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
      fields.setEditCycleStartDate ||
        fields.editCycleLengthWeeks !== undefined ||
        fields.editMvLevel !== undefined ||
        fields.editModality !== undefined ||
        options.cycleLengthOptions?.length ||
        options.mvLevelOptions?.length ||
        options.modalityOptions?.length
    );

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
          section="agenda"
          title="Agenda"
          summary={`${fields.editStartTime || "--:--"} • ${fields.editEndTime || "--:--"}`}
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
        </EditSectionCard>

        <EditSectionCard
          section="profile"
          title="Perfil esportivo"
          summary={`${resolveAgeBandLabel()} • ${resolveGenderLabel(fields.editGender)} • ${resolveGoalLabel()}`}
          isOpen={openSection === "profile"}
          onToggle={handleToggleSection}
          colors={colors}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Faixa etária</Text>
              <View ref={refs.editAgeBandTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("age")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {resolveAgeBandLabel()}
                  </Text>
                  <Ionicons
                    name="chevron-down"
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
              <View ref={refs.editGenderTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("gender")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {resolveGenderLabel(fields.editGender)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: pickers.showEditGenderPicker ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Objetivo</Text>
            <View ref={refs.editGoalTriggerRef}>
              <Pressable onPress={() => actions.toggleEditPicker("goal")} style={selectFieldStyle}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  {resolveGoalLabel()}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={colors.muted}
                  style={{ transform: [{ rotate: pickers.showEditGoalPicker ? "180deg" : "0deg" }] }}
                />
              </Pressable>
            </View>
            {fields.editShowCustomGoal ? (
              <TextInput
                placeholder="Personalizar objetivo"
                value={fields.editCustomGoal ?? ""}
                onChangeText={(value) => {
                  fields.setEditCustomGoal?.(value);
                  fields.setEditGoal?.(value);
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
        </EditSectionCard>

        {hasAdvancedSection ? (
          <EditSectionCard
            section="advanced"
            title="Planejamento"
            summary="Macrociclo, modalidade e nível"
            isOpen={openSection === "advanced"}
            onToggle={handleToggleSection}
            colors={colors}
          >
            {fields.setEditCycleStartDate ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Início do ciclo</Text>
                <DateInput
                  value={fields.editCycleStartDate ?? ""}
                  onChange={(value) => fields.setEditCycleStartDate?.(value)}
                  placeholder="Início do ciclo"
                  onOpenCalendar={actions.setShowEditCycleCalendar ? () => actions.setShowEditCycleCalendar?.(true) : undefined}
                />
              </View>
            ) : null}

            {fields.editCycleLengthWeeks !== undefined && actions.handleEditSelectCycleLength && options.cycleLengthOptions?.length ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Macrociclo anual</Text>
                <View ref={refs.editCycleLengthTriggerRef}>
                  <Pressable onPress={() => actions.toggleEditPicker("cycle")} style={selectFieldStyle}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {fields.editCycleLengthWeeks ? formatAnnualCycleLabel(fields.editCycleLengthWeeks) : "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{ transform: [{ rotate: pickers.showEditCycleLengthPicker ? "180deg" : "0deg" }] }}
                    />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {fields.editMvLevel !== undefined && actions.handleEditSelectMvLevel && options.mvLevelOptions?.length ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Nível MV</Text>
                <View ref={refs.editMvLevelTriggerRef}>
                  <Pressable onPress={() => actions.toggleEditPicker("level")} style={selectFieldStyle}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {fields.editMvLevel || "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{ transform: [{ rotate: pickers.showEditMvLevelPicker ? "180deg" : "0deg" }] }}
                    />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {fields.editModality !== undefined && actions.handleEditSelectModality && options.modalityOptions?.length ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Modalidade</Text>
                <View ref={refs.editModalityTriggerRef}>
                  <Pressable onPress={() => actions.toggleEditPicker("modality")} style={selectFieldStyle}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {fields.editModality || "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
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
          refs={refs}
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
      >
        <View style={{ gap: 6 }}>
          {(options.modalityOptions ?? []).map((option) => (
            <SelectOption
              key={option.value}
              label={option.label}
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
