import { Text, View } from "react-native";
import type { CourtActorAction } from "../../core/visual-court";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

const actions: { value: CourtActorAction | undefined; label: string }[] = [
  { value: undefined, label: "Automática" }, { value: "ready", label: "Preparar" },
  { value: "defend", label: "Defender" }, { value: "block", label: "Bloquear" },
  { value: "attack", label: "Atacar" }, { value: "set", label: "Levantar" },
  { value: "serve", label: "Sacar" },
];

export function CourtActorActionPicker({ value, onChange, disabled = false, simulated = false }: {
  value?: CourtActorAction; onChange: (value: CourtActorAction | undefined) => void;
  disabled?: boolean; simulated?: boolean;
}) {
  const { colors } = useAppTheme();
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>Ação nesta etapa</Text>
    {simulated ? <Text style={{ color: colors.muted, fontSize: 12 }}>Ação definida pela simulação.</Text> :
      <View accessibilityRole="radiogroup" accessibilityLabel="Ação do jogador" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {actions.map(action => <Pressable key={action.value ?? "auto"} accessibilityRole="radio"
          accessibilityLabel={`Ação: ${action.label}`} accessibilityState={{ checked: action.value === value, disabled }}
          aria-checked={action.value === value} disabled={disabled} onPress={() => onChange(action.value)}
          suppressWebHoverFeedback disableWebPressScale
          style={({ hovered, pressed }) => ({ minWidth: action.value === undefined ? "100%" : "30%", flexGrow: 1, minHeight: 44, paddingHorizontal: 8,
            justifyContent: "center", alignItems: "center", borderRadius: 10, borderWidth: 1,
            borderColor: action.value === value ? colors.primaryBg : colors.border,
            backgroundColor: action.value === value ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : colors.inputBg,
            opacity: disabled ? 0.55 : 1 })}>
          <Text style={{ color: action.value === value ? colors.primaryText : colors.text, fontSize: 12 }}>{action.label}</Text>
        </Pressable>)}
      </View>}
  </View>;
}
