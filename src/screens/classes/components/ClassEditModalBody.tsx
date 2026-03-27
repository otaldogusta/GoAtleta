import { memo, type RefObject } from "react";

import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput, View } from "react-native";

import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { DateInput } from "../../../ui/DateInput";
import { DatePickerModal } from "../../../ui/DatePickerModal";
import { FadeHorizontalScroll } from "../../../ui/FadeHorizontalScroll";
import { useAppTheme } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";
import { type ClassGroup } from "../../../core/models";

type PickerLayout = { x: number; y: number; width: number; height: number };
type WindowPosition = { x: number; y: number };
type SelectOptionValue = string | number;

type ColorOption = {
  key: string;
  label: string;
  palette: { bg: string; text: string };
};

type Option = { value: string; label: string };

type ClassEditModalBodyProps = {
  refs: {
    editContainerRef: RefObject<View | null>;
    editDurationTriggerRef: RefObject<View | null>;
    editCycleLengthTriggerRef: RefObject<View | null>;
    editMvLevelTriggerRef: RefObject<View | null>;
    editAgeBandTriggerRef: RefObject<View | null>;
    editGenderTriggerRef: RefObject<View | null>;
    editModalityTriggerRef: RefObject<View | null>;
    editGoalTriggerRef: RefObject<View | null>;
  };
  layouts: {
    editContainerWindow: WindowPosition | null;
    editDurationTriggerLayout: PickerLayout | null;
    editCycleLengthTriggerLayout: PickerLayout | null;
    editMvLevelTriggerLayout: PickerLayout | null;
    editAgeBandTriggerLayout: PickerLayout | null;
    editGenderTriggerLayout: PickerLayout | null;
    editModalityTriggerLayout: PickerLayout | null;
    editGoalTriggerLayout: PickerLayout | null;
  };
  pickers: {
    showEditDurationPicker: boolean;
    showEditCycleLengthPicker: boolean;
    showEditMvLevelPicker: boolean;
    showEditAgeBandPicker: boolean;
    showEditGenderPicker: boolean;
    showEditModalityPicker: boolean;
    showEditGoalPicker: boolean;
    showEditDurationPickerContent: boolean;
    showEditCycleLengthPickerContent: boolean;
    showEditMvLevelPickerContent: boolean;
    showEditAgeBandPickerContent: boolean;
    showEditGenderPickerContent: boolean;
    showEditModalityPickerContent: boolean;
    showEditGoalPickerContent: boolean;
    editDurationPickerAnimStyle: any;
    editCycleLengthPickerAnimStyle: any;
    editMvLevelPickerAnimStyle: any;
    editAgeBandPickerAnimStyle: any;
    editGenderPickerAnimStyle: any;
    editModalityPickerAnimStyle: any;
    editGoalPickerAnimStyle: any;
    showEditCycleCalendar: boolean;
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
    editDuration: string;
    setEditDuration: (value: string) => void;
    editShowCustomDuration: boolean;
    editCycleStartDate: string;
    setEditCycleStartDate: (value: string) => void;
    editCycleLengthWeeks: number;
    editMvLevel: string;
    editAgeBand: string;
    setEditAgeBand: (value: string) => void;
    editShowAllAges: boolean;
    editGender: ClassGroup["gender"];
    editModality: ClassGroup["modality"];
    editShowCustomGoal: boolean;
    editGoal: string;
    editCustomGoal: string;
    setEditCustomGoal: (value: string) => void;
    editDays: number[];
    toggleEditDay: (value: number) => void;
    editFormError: string;
    editSaving: boolean;
    isEditDirty: boolean;
  };
  options: {
    dayNames: string[];
    durationOptions: string[];
    cycleLengthOptions: number[];
    ageBandOptions: string[];
    genderOptions: Option[];
    modalityOptions: Option[];
    mvLevelOptions: Option[];
    goalOptions: string[];
    customOptionLabel: string;
  };
  actions: {
    closeAllPickers: () => void;
    toggleEditPicker: (target: "duration" | "cycle" | "level" | "age" | "gender" | "modality" | "goal") => void;
    handleEditSelectDuration: (value: SelectOptionValue) => void;
    handleEditSelectCycleLength: (value: SelectOptionValue) => void;
    handleEditSelectMvLevel: (value: SelectOptionValue) => void;
    handleEditSelectAgeBand: (value: SelectOptionValue) => void;
    handleEditSelectGender: (value: SelectOptionValue) => void;
    handleEditSelectModality: (value: SelectOptionValue) => void;
    handleEditSelectGoal: (value: SelectOptionValue) => void;
    saveEditClass: () => void;
    handleDeleteClass: () => void;
    setShowEditCycleCalendar: (value: boolean) => void;
  };
};

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
  refs,
  layouts,
  pickers,
  fields,
  options,
  actions,
}: ClassEditModalBodyProps) {
  const { colors } = useAppTheme();
  const sectionCardStyle = getSectionCardStyle(colors, "neutral", {
    padding: 12,
    radius: 16,
    shadow: false,
  });
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
        <View ref={refs.editContainerRef} style={{ position: "relative", gap: 12 }}>
        <View style={sectionCardStyle}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Dados básicos</Text>
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

          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 6 }}>Agenda</Text>
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
              <Text style={{ color: colors.muted, fontSize: 11 }}>Duração</Text>
              <View ref={refs.editDurationTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("duration")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {fields.editDuration ? `${fields.editDuration} min` : "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: pickers.showEditDurationPicker ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
              </View>
              {fields.editShowCustomDuration ? (
                <TextInput
                  placeholder="Duração (min)"
                  value={fields.editDuration}
                  onChangeText={fields.setEditDuration}
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
              ) : null}
            </View>
          </View>

          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 6 }}>Ciclo e perfil</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Data início do ciclo</Text>
              <DateInput
                value={fields.editCycleStartDate}
                onChange={fields.setEditCycleStartDate}
                onOpenCalendar={() => actions.setShowEditCycleCalendar(true)}
                placeholder="DD/MM/AAAA"
              />
            </View>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Duração do ciclo</Text>
              <View ref={refs.editCycleLengthTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("cycle")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {fields.editCycleLengthWeeks ? `${fields.editCycleLengthWeeks} semanas` : "Selecione"}
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
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Nível</Text>
              <View ref={refs.editMvLevelTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("level")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {options.mvLevelOptions.find((option) => option.value === fields.editMvLevel)?.label || "Selecione"}
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
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Faixa etária</Text>
              <View ref={refs.editAgeBandTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("age")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {fields.editAgeBand || "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: pickers.showEditAgeBandPicker ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
              </View>
              {fields.editShowAllAges ? (
                <TextInput
                  placeholder="Faixa etária (ex: 14-16)"
                  value={fields.editAgeBand}
                  onChangeText={fields.setEditAgeBand}
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
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Gênero</Text>
            <View ref={refs.editGenderTriggerRef}>
              <Pressable onPress={() => actions.toggleEditPicker("gender")} style={selectFieldStyle}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  {options.genderOptions.find((option) => option.value === fields.editGender)?.label || "Selecione"}
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

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Modalidade</Text>
              <View ref={refs.editModalityTriggerRef}>
                <Pressable onPress={() => actions.toggleEditPicker("modality")} style={selectFieldStyle}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {options.modalityOptions.find((option) => option.value === fields.editModality)?.label || "Selecione"}
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
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Objetivo</Text>
              <View ref={refs.editGoalTriggerRef} style={{ width: "100%" }}>
                <Pressable onPress={() => actions.toggleEditPicker("goal")} style={[selectFieldStyle, { width: "100%" }]}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {fields.editShowCustomGoal
                      ? fields.editCustomGoal || "Personalizar"
                      : fields.editGoal || "Selecione"}
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
                  placeholder="Objetivo (ex: Força, Potência)"
                  value={fields.editCustomGoal}
                  onChangeText={fields.setEditCustomGoal}
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
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Dias da semana</Text>
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
          </View>

          {fields.editFormError ? (
            <Text style={{ color: colors.dangerText, fontSize: 12 }}>{fields.editFormError}</Text>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
        </View>
      </View>

      <AnchoredDropdown
        visible={pickers.showEditDurationPickerContent}
        layout={layouts.editDurationTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editDurationPickerAnimStyle}
        zIndex={320}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        panelStyle={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ gap: 6 }}>
          {options.durationOptions.map((option) => (
            <SelectOption
              key={option}
              label={`${option} min`}
              value={option}
              active={fields.editDuration === option}
              onSelect={actions.handleEditSelectDuration}
            />
          ))}
          <SelectOption
            label={options.customOptionLabel}
            value={options.customOptionLabel}
            active={fields.editShowCustomDuration}
            onSelect={actions.handleEditSelectDuration}
          />
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={pickers.showEditCycleLengthPickerContent}
        layout={layouts.editCycleLengthTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editCycleLengthPickerAnimStyle}
        zIndex={321}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        panelStyle={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ gap: 6 }}>
          {options.cycleLengthOptions.map((option) => (
            <SelectOption
              key={option}
              label={`${option} semanas`}
              value={option}
              active={fields.editCycleLengthWeeks === option}
              onSelect={actions.handleEditSelectCycleLength}
            />
          ))}
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={pickers.showEditMvLevelPickerContent}
        layout={layouts.editMvLevelTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editMvLevelPickerAnimStyle}
        zIndex={322}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        panelStyle={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ gap: 6 }}>
          {options.mvLevelOptions.map((option, index) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={fields.editMvLevel === option.value}
              onSelect={actions.handleEditSelectMvLevel}
            />
          ))}
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={pickers.showEditAgeBandPickerContent}
        layout={layouts.editAgeBandTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editAgeBandPickerAnimStyle}
        zIndex={323}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        panelStyle={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ gap: 6 }}>
          {options.ageBandOptions.map((option) => (
            <SelectOption
              key={option}
              label={option}
              value={option}
              active={fields.editAgeBand === option}
              onSelect={actions.handleEditSelectAgeBand}
            />
          ))}
          <SelectOption
            label={options.customOptionLabel}
            value={options.customOptionLabel}
            active={fields.editShowAllAges}
            onSelect={actions.handleEditSelectAgeBand}
          />
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={pickers.showEditGenderPickerContent}
        layout={layouts.editGenderTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editGenderPickerAnimStyle}
        zIndex={324}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        panelStyle={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
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
        visible={pickers.showEditModalityPickerContent}
        layout={layouts.editModalityTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editModalityPickerAnimStyle}
        zIndex={325}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        panelStyle={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ gap: 6 }}>
          {options.modalityOptions.map((option) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={fields.editModality === option.value}
              onSelect={actions.handleEditSelectModality}
            />
          ))}
        </View>
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={pickers.showEditGoalPickerContent}
        layout={layouts.editGoalTriggerLayout}
        container={layouts.editContainerWindow}
        animationStyle={pickers.editGoalPickerAnimStyle}
        zIndex={326}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={actions.closeAllPickers}
        panelStyle={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
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
            active={fields.editShowCustomGoal}
            onSelect={actions.handleEditSelectGoal}
          />
        </View>
      </AnchoredDropdown>

      <DatePickerModal
        visible={pickers.showEditCycleCalendar}
        value={fields.editCycleStartDate}
        onChange={fields.setEditCycleStartDate}
        onClose={() => actions.setShowEditCycleCalendar(false)}
      />
    </>
  );
}

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
