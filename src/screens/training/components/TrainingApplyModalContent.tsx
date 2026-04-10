import { memo, type Dispatch, type RefObject, type SetStateAction } from "react";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { DateInput } from "../../../ui/DateInput";
import { DatePickerModal } from "../../../ui/DatePickerModal";
import { useAppTheme } from "../../../ui/app-theme";
import type { ClassGroup } from "../../../core/models";
import { TrainingAnchoredDropdownOption } from "./TrainingAnchoredDropdownOption";

type PickerLayout = { x: number; y: number; width: number; height: number };
type WindowPosition = { x: number; y: number };

type TrainingApplyModalContentProps = {
  refs: {
    applyContainerRef: RefObject<View | null>;
    applyUnitTriggerRef: RefObject<View | null>;
    applyClassTriggerRef: RefObject<View | null>;
  };
  layouts: {
    applyContainerWindow: WindowPosition | null;
    applyUnitTriggerLayout: PickerLayout | null;
    applyClassTriggerLayout: PickerLayout | null;
  };
  pickers: {
    showApplyUnitPicker: boolean;
    showApplyClassPicker: boolean;
    showApplyUnitPickerContent: boolean;
    showApplyClassPickerContent: boolean;
    applyUnitPickerAnimStyle: any;
    applyClassPickerAnimStyle: any;
    showApplyCalendar: boolean;
  };
  state: {
    applyUnit: string;
    applyClassId: string;
    applyDays: number[];
    applyDate: string;
    selectedApplyClass: ClassGroup | null;
  };
  data: {
    allUnitsValue: string;
    weekdays: { id: number; label: string }[];
    unitOptions: string[];
    classOptionsForUnit: ClassGroup[];
  };
  actions: {
    closeApplyPickers: () => void;
    syncApplyPickerLayouts: () => void;
    toggleApplyPicker: (target: "unit" | "class") => void;
    setApplyUnit: Dispatch<SetStateAction<string>>;
    setApplyClassId: Dispatch<SetStateAction<string>>;
    setApplyDays: Dispatch<SetStateAction<number[]>>;
    setApplyDate: Dispatch<SetStateAction<string>>;
    setShowApplyCalendar: Dispatch<SetStateAction<boolean>>;
    onApply: () => void | Promise<void>;
  };
  canApply: boolean;
};

function TrainingApplyModalContentBase({
  refs,
  layouts,
  pickers,
  state,
  data,
  actions,
  canApply,
}: TrainingApplyModalContentProps) {
  const { colors } = useAppTheme();

  return (
    <>
      <ScrollView
        contentContainerStyle={{ gap: 10 }}
        style={{ maxHeight: "94%" }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        onScrollBeginDrag={actions.closeApplyPickers}
      >
        <View
          ref={refs.applyContainerRef}
          onLayout={actions.syncApplyPickerLayouts}
          style={{ gap: 10, position: "relative" }}
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Unidade</Text>
              <View ref={refs.applyUnitTriggerRef}>
                <Pressable
                  onPress={() => actions.toggleApplyPicker("unit")}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {state.applyUnit === data.allUnitsValue
                      ? "Todas as unidades"
                      : state.applyUnit || "Selecione uma unidade"}
                  </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={18}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: pickers.showApplyUnitPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                </Pressable>
              </View>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>
              <View ref={refs.applyClassTriggerRef}>
                <Pressable
                  onPress={() => actions.toggleApplyPicker("class")}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                      {state.selectedApplyClass?.name ?? "Selecione uma turma"}
                    </Text>
                    {state.selectedApplyClass ? (
                      <ClassGenderBadge gender={state.selectedApplyClass.gender} />
                    ) : null}
                  </View>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={18}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: pickers.showApplyClassPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                </Pressable>
              </View>
            </View>
          </View>

          <Text style={{ color: colors.muted, fontSize: 12 }}>Dias da semana</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {data.weekdays.map((day) => {
              const active = state.applyDays.includes(day.id);
              return (
                <Pressable
                  key={day.id}
                  onPress={() =>
                    actions.setApplyDays((prev) =>
                      prev.includes(day.id)
                        ? prev.filter((value) => value !== day.id)
                        : [...prev, day.id].sort((a, b) => a - b)
                    )
                  }
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: colors.muted, fontSize: 12 }}>Data específica</Text>
          <DateInput
            value={state.applyDate}
            onChange={(value) => {
              actions.setApplyDate(value);
              actions.closeApplyPickers();
            }}
            placeholder="Selecione a data"
            onOpenCalendar={() => actions.setShowApplyCalendar(true)}
          />

          <AnchoredDropdown
            visible={pickers.showApplyUnitPickerContent}
            layout={layouts.applyUnitTriggerLayout}
            container={layouts.applyContainerWindow}
            animationStyle={pickers.applyUnitPickerAnimStyle}
            zIndex={420}
            maxHeight={220}
            nestedScrollEnabled
            scrollContentStyle={{ padding: 8, gap: 6 }}
            onRequestClose={actions.closeApplyPickers}
          >
            {[
              { label: "Selecione uma unidade", value: "" },
              { label: "Todas as unidades", value: data.allUnitsValue },
              ...data.unitOptions.map((unit) => ({ label: unit, value: unit })),
            ].map((option) => {
              const active = state.applyUnit === option.value;
              return (
                <TrainingAnchoredDropdownOption
                  key={option.value || "unit-empty"}
                  active={active}
                  onPress={() => {
                    actions.setApplyClassId("");
                    actions.setApplyUnit(option.value);
                    actions.closeApplyPickers();
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.primaryText : colors.text,
                      fontSize: 14,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                </TrainingAnchoredDropdownOption>
              );
            })}
          </AnchoredDropdown>

          <AnchoredDropdown
            visible={pickers.showApplyClassPickerContent}
            layout={layouts.applyClassTriggerLayout}
            container={layouts.applyContainerWindow}
            animationStyle={pickers.applyClassPickerAnimStyle}
            zIndex={420}
            maxHeight={240}
            nestedScrollEnabled
            scrollContentStyle={{ padding: 8, gap: 6 }}
            onRequestClose={actions.closeApplyPickers}
          >
            {data.classOptionsForUnit.length ? (
              data.classOptionsForUnit.map((item) => {
                const active = state.applyClassId === item.id;
                return (
                  <TrainingAnchoredDropdownOption
                    key={item.id}
                    active={active}
                    onPress={() => {
                      actions.setApplyClassId(item.id);
                      actions.closeApplyPickers();
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <Text
                        style={{
                          color: active ? colors.primaryText : colors.text,
                          fontSize: 14,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {item.name}
                      </Text>
                      <ClassGenderBadge gender={item.gender} />
                    </View>
                  </TrainingAnchoredDropdownOption>
                );
              })
            ) : (
              <View style={{ padding: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {state.applyUnit ? "Nenhuma turma cadastrada." : "Selecione uma unidade."}
                </Text>
              </View>
            )}
          </AnchoredDropdown>
        </View>
      </ScrollView>

      <Pressable
        onPress={actions.onApply}
        disabled={!canApply}
        style={{
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: canApply ? colors.primaryBg : colors.primaryDisabledBg,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: canApply ? colors.primaryText : colors.secondaryText,
            fontWeight: "700",
          }}
        >
          Aplicar nesta turma
        </Text>
      </Pressable>

      <DatePickerModal
        visible={pickers.showApplyCalendar}
        value={state.applyDate}
        onChange={actions.setApplyDate}
        onClose={() => actions.setShowApplyCalendar(false)}
        closeOnSelect
      />
    </>
  );
}

export const TrainingApplyModalContent = memo(TrainingApplyModalContentBase);
TrainingApplyModalContent.displayName = "TrainingApplyModalContent";
