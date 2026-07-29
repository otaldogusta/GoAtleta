import {
  memo,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Text, TextInput, View } from "react-native";

import type { ClassGroup, Student } from "../../core/models";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import type { ThemeColors } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useCollapsibleAnimation } from "../../ui/use-collapsible";
import { BirthdayAvatar } from "./components/BirthdayAvatar";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type BirthdayEntry = { student: Student; date: Date; unitName: string };
type BirthdayUnitGroup = [string, BirthdayEntry[]];
type BirthdayMonthGroup = [number, BirthdayUnitGroup[]];
type UpcomingBirthday = { student: Student; date: Date; daysLeft: number };

type BirthdaysTabProps = {
  colors: ThemeColors;
  birthdayMonthFilter: "Todas" | number;
  setBirthdayMonthFilter: (value: "Todas" | number) => void;
  birthdaySearch: string;
  setBirthdaySearch: (value: string) => void;
  birthdayToday: Student[];
  upcomingBirthdays: UpcomingBirthday[];
  showAllBirthdays: boolean;
  setShowAllBirthdays: Dispatch<SetStateAction<boolean>>;
  showAllBirthdaysContent: boolean;
  allBirthdaysAnimStyle: object;
  birthdayUnitOptions: string[];
  birthdayUnitFilter: string;
  setBirthdayUnitFilter: (value: string) => void;
  birthdayMonthGroups: BirthdayMonthGroup[];
  students: Student[];
  classById: Map<string, ClassGroup>;
  unitLabel: (value: string) => string;
  calculateAge: (iso: string) => number | null;
  formatShortDate: (value: string) => string;
};

export const BirthdaysTab = memo(function BirthdaysTab({
  colors,
  birthdayMonthFilter,
  setBirthdayMonthFilter,
  birthdaySearch,
  setBirthdaySearch,
  birthdayToday,
  upcomingBirthdays,
  birthdayUnitOptions,
  birthdayUnitFilter,
  setBirthdayUnitFilter,
  birthdayMonthGroups,
  students,
  classById,
  unitLabel,
  calculateAge,
  formatShortDate,
}: BirthdaysTabProps) {
  const [unitSearch, setUnitSearch] = useState("");
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthTriggerLayout, setMonthTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const monthTriggerRef = useRef<View>(null);
  const { animatedStyle: monthPickerAnimStyle, isVisible: monthPickerVisible } =
    useCollapsibleAnimation(showMonthPicker, { translateY: -4 });
  const allEntries = birthdayMonthGroups
    .flatMap(([month, unitGroups]) =>
      unitGroups.flatMap(([, items]) =>
        items.map((item) => ({ ...item, month })),
      ),
    )
    .sort((a, b) => a.month - b.month || a.date.getDate() - b.date.getDate());
  const todayEntries = birthdayToday
    .map((student) => {
      const match = allEntries.find((entry) => entry.student.id === student.id);
      return match ?? null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const upcomingEntries = upcomingBirthdays
    .map(({ student }) => {
      const match = allEntries.find((entry) => entry.student.id === student.id);
      return match ?? null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const entries = [...todayEntries, ...upcomingEntries].filter(
    (entry) =>
      birthdayUnitFilter === "Todas" ||
      entry.unitName === birthdayUnitFilter,
  );
  const unitCounts = Object.fromEntries(
    birthdayUnitOptions.map((unit) => [
      unit,
      unit === "Todas"
        ? students.length
        : students.filter((student) => {
            const cls = classById.get(student.classId);
            return unitLabel(cls?.unit ?? "") === unit;
          }).length,
    ]),
  );
  const filteredTodayCount = todayEntries.filter(
    (entry) =>
      birthdayUnitFilter === "Todas" ||
      entry.unitName === birthdayUnitFilter,
  ).length;
  const nextSevenDays = upcomingBirthdays.filter((entry) => {
    if (entry.daysLeft > 7) return false;
    if (birthdayUnitFilter === "Todas") return true;
    const cls = classById.get(entry.student.classId);
    return unitLabel(cls?.unit ?? "") === birthdayUnitFilter;
  }).length;
  const visibleUnitOptions = useMemo(() => {
    const query = unitSearch.trim().toLocaleLowerCase("pt-BR");
    return birthdayUnitOptions.filter((unit) =>
      (unit === "Todas" ? "Todas as unidades" : unit)
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [birthdayUnitOptions, unitSearch]);

  return (
    <View
      style={{
        minHeight: 620,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: "row",
      }}
    >
      <View
        style={{
          width: 280,
          padding: 16,
          gap: 12,
          borderRightWidth: 1,
          borderRightColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
          Unidades
        </Text>
        <View
          style={{
            minHeight: 42,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 11,
            backgroundColor: colors.inputBg,
            paddingHorizontal: 11,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <GoAtletaIcon name="search" size={15} color={colors.muted} />
          <TextInput
            value={unitSearch}
            onChangeText={setUnitSearch}
            placeholder="Filtrar por unidade"
            placeholderTextColor={colors.placeholder}
            style={{ flex: 1, color: colors.text, fontSize: 12 }}
          />
        </View>
        <View>
          {visibleUnitOptions.map((unit) => {
            const active = birthdayUnitFilter === unit;
            return (
              <Pressable
                key={unit}
                onPress={() => setBirthdayUnitFilter(unit)}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 10,
                  borderLeftWidth: 3,
                  borderLeftColor: active ? colors.primaryBg : "transparent",
                  backgroundColor: active
                    ? colors.backgroundSubtle
                    : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                }}
              >
                <GoAtletaIcon
                  name={unit === "Todas" ? "classes" : "organization"}
                  size={15}
                  color={active ? colors.text : colors.muted}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: active ? colors.text : colors.muted,
                    fontSize: 12,
                    fontWeight: active ? "800" : "700",
                  }}
                >
                  {unit === "Todas" ? "Todas as unidades" : unit}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {unitCounts[unit] ?? 0}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0, padding: 16, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[
            {
              label: "Hoje",
              value: filteredTodayCount,
              caption:
                filteredTodayCount === 1 ? "aniversário" : "aniversários",
            },
            {
              label: "Próximos 7 dias",
              value: nextSevenDays,
              caption: nextSevenDays === 1 ? "aniversário" : "aniversários",
            },
          ].map((metric) => (
            <View
              key={metric.label}
              style={{
                flex: 1,
                minHeight: 96,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}
              >
                {metric.label}
              </Text>
              <Text
                style={{
                  color: colors.primaryBg,
                  fontSize: 22,
                  fontWeight: "900",
                  marginTop: 4,
                }}
              >
                {metric.value}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {metric.caption}
              </Text>
            </View>
          ))}
        </View>

        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
          Próximos aniversários
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              flex: 1,
              minHeight: 42,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 11,
              backgroundColor: colors.inputBg,
              paddingHorizontal: 11,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <GoAtletaIcon name="search" size={15} color={colors.muted} />
            <TextInput
              value={birthdaySearch}
              onChangeText={setBirthdaySearch}
              placeholder="Buscar aluno"
              placeholderTextColor={colors.placeholder}
              style={{ flex: 1, color: colors.text, fontSize: 12 }}
            />
          </View>
          <View ref={monthTriggerRef}>
            <Pressable
              onPress={() => {
                monthTriggerRef.current?.measureInWindow(
                  (x, y, width, height) => {
                    setMonthTriggerLayout({ x, y, width, height });
                    setShowMonthPicker((current) => !current);
                  },
                );
              }}
              style={{
                minWidth: 150,
                minHeight: 42,
                borderWidth: 1,
                borderColor: showMonthPicker
                  ? colors.primaryBg
                  : colors.border,
                borderRadius: 11,
                paddingHorizontal: 12,
                alignItems: "center",
                justifyContent: "space-between",
                flexDirection: "row",
              }}
            >
              <Text
                style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}
              >
                {birthdayMonthFilter === "Todas"
                  ? "Mês: Todos"
                  : `Mês: ${monthNames[birthdayMonthFilter]}`}
              </Text>
              <GoAtletaIcon
                name={showMonthPicker ? "chevronUp" : "chevronDown"}
                size={14}
                color={colors.muted}
              />
            </Pressable>
          </View>
        </View>

        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              minHeight: 38,
              paddingHorizontal: 12,
              backgroundColor: colors.backgroundSubtle,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            {[
              ["Aluno", 2],
              ["Aniversário", 1],
              ["Idade", 0.7],
              ["Turma", 1],
              ["Contato", 1.2],
            ].map(([label, flex]) => (
              <Text
                key={String(label)}
                style={{
                  flex: Number(flex),
                  color: colors.muted,
                  fontSize: 10,
                  fontWeight: "800",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </Text>
            ))}
            <View style={{ width: 30 }} />
          </View>
          {entries.length ? (
            entries.slice(0, 40).map(({ student, date }, index) => {
              const cls = classById.get(student.classId);
              const age = calculateAge(student.birthDate);
              const isToday = birthdayToday.some(
                (item) => item.id === student.id,
              );
              return (
                <View
                  key={student.id}
                  style={{
                    minHeight: 56,
                    paddingHorizontal: 12,
                    borderBottomWidth: index === entries.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                    backgroundColor: isToday
                      ? colors.backgroundSubtle
                      : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flex: 2,
                      minWidth: 0,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 9,
                    }}
                  >
                    <BirthdayAvatar
                      colors={colors}
                      photoUrl={student.photoUrl}
                      isBirthdayToday={isToday}
                      size={32}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: colors.text,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      {student.name}
                    </Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {formatShortDate(student.birthDate)}
                    </Text>
                    {isToday ? (
                      <Text
                        style={{
                          color: colors.successText,
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        Hoje
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{ flex: 0.7, color: colors.muted, fontSize: 11 }}
                  >
                    {age ?? "—"} anos
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: colors.muted, fontSize: 11 }}
                  >
                    {cls?.name ?? "Turma"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1.2, color: colors.muted, fontSize: 11 }}
                  >
                    {student.guardianPhone || student.phone || "Sem contato"}
                  </Text>
                  <View
                    style={{
                      width: 30,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <GoAtletaIcon
                      name="whatsapp"
                      size={16}
                      color={colors.primaryBg}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Nenhum aniversário encontrado.
              </Text>
            </View>
          )}
        </View>
      </View>
      <AnchoredDropdown
        visible={monthPickerVisible}
        layout={monthTriggerLayout}
        container={null}
        animationStyle={monthPickerAnimStyle}
        zIndex={6500}
        maxHeight={260}
        nestedScrollEnabled
        density="compact"
        onRequestClose={() => setShowMonthPicker(false)}
        interactiveRefs={[monthTriggerRef]}
      >
        {[
          { value: "Todas" as const, label: "Todos os meses" },
          ...monthNames.map((label, value) => ({ value, label })),
        ].map((option) => {
          const active = birthdayMonthFilter === option.value;
          return (
            <AnchoredDropdownOption
              key={String(option.value)}
              active={active}
              density="compact"
              onPress={() => {
                setBirthdayMonthFilter(option.value);
                setShowMonthPicker(false);
              }}
            >
              <Text
                style={{
                  color: active ? colors.primaryText : colors.text,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {option.label}
              </Text>
            </AnchoredDropdownOption>
          );
        })}
      </AnchoredDropdown>
    </View>
  );
});
