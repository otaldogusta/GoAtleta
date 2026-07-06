import { Text, View } from "react-native";

import {
  DEFENSE_ATTACK_ORIGIN_LABELS,
  DEFENSE_ATTACK_ORIGIN_ORDER,
  DEFENSE_KIND_LABELS,
  DEFENSE_KIND_ORDER,
  getSetterPositionLabel,
  CourtVisualPayload,
  CourtVisualPhase,
  CourtVisualRotationIndex,
  CourtVisualAttackOrigin,
  CourtVisualDefenseKind,
} from "../../core/visual-court";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";

type Props = {
  payload: CourtVisualPayload;
  stepIndex: number;
  isPlaying: boolean;
  canPlay?: boolean;
  speed: number;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onSelectStep: (index: number) => void;
  onSetSpeed: (speed: number) => void;
  mode?: "timeline" | "rotation_phase";
};

const speedOptions = [0.75, 1, 1.5, 2];
const phaseOrder: CourtVisualPhase[] = [
  "receive_legal",
  "serve_base",
  "receive_release",
  "serve_after_hit",
];
const phaseLabel: Record<CourtVisualPhase, string> = {
  receive_legal: "Antes do saque",
  serve_base: "Antes do saque",
  receive_release: "Após o saque",
  serve_after_hit: "Após o saque",
  attack_shape: "Ataque",
  defense_shape: "Defesa",
};

export function VisualCourtTimelineControls({
  payload,
  stepIndex,
  isPlaying,
  canPlay = true,
  speed,
  onPrevious,
  onNext,
  onTogglePlay,
  onSelectStep,
  onSetSpeed,
  mode = "timeline",
}: Props) {
  const { colors } = useAppTheme();
  const steps = payload.timeline.steps;
  const currentStep = steps[stepIndex];
  const defenseMode =
    currentStep?.formationKind === "defense_base_6_back" ||
    steps.some((step) => step.formationKind === "defense_base_6_back");
  const receiveEditorMode =
    currentStep?.formationKind === "5x1_receive_3" ||
    steps.some((step) => step.formationKind === "5x1_receive_3");
  const servingEditorMode =
    currentStep?.formationKind === "5x1_serving" ||
    steps.some((step) => step.formationKind === "5x1_serving");
  const rotationPhaseMode =
    mode === "rotation_phase" &&
    steps.some((step) => step.rotationIndex && step.phase);
  const rotations = Array.from(
    new Set(
      steps
        .map((step) => step.rotationIndex)
        .filter((item): item is CourtVisualRotationIndex => Boolean(item))
    )
  ).sort((a, b) => a - b);
  const phases = phaseOrder.filter(
    (phase) =>
      steps.some((step) => step.phase === phase) &&
      !(receiveEditorMode && phase === "receive_release") &&
      !(servingEditorMode && phase === "serve_after_hit")
  );
  const playDisabled = !canPlay && !isPlaying;

  const selectRotationPhase = (
    rotationIndex: CourtVisualRotationIndex,
    phase: CourtVisualPhase
  ) => {
    const nextIndex = steps.findIndex(
      (step) => step.rotationIndex === rotationIndex && step.phase === phase
    );
    if (nextIndex >= 0) onSelectStep(nextIndex);
  };
  const selectDefenseStep = (
    rotationIndex: CourtVisualRotationIndex,
    attackOrigin: CourtVisualAttackOrigin,
    defenseKind: CourtVisualDefenseKind
  ) => {
    const nextIndex = steps.findIndex(
      (step) =>
        step.rotationIndex === rotationIndex &&
        step.attackOrigin === attackOrigin &&
        step.defenseKind === defenseKind
    );
    if (nextIndex >= 0) onSelectStep(nextIndex);
  };

  return (
    <View
      style={{
        gap: 12,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <IconButton icon="skipBack" label="Passo anterior" onPress={onPrevious} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            playDisabled
              ? "Sem animação disponível"
              : isPlaying
              ? "Pausar animação"
              : "Reproduzir animação"
          }
          accessibilityState={{ disabled: playDisabled }}
          disabled={playDisabled}
          onPress={playDisabled ? undefined : onTogglePlay}
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: playDisabled ? colors.secondaryBg : colors.primaryBg,
            opacity: playDisabled ? 0.54 : 1,
          }}
        >
          <GoAtletaIcon
            name={isPlaying ? "pause" : "play"}
            size={22}
            color={playDisabled ? colors.muted : colors.primaryText}
          />
        </Pressable>
        <IconButton icon="skipForward" label="Próximo passo" onPress={onNext} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>
            {currentStep?.label ?? "Passo"}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>
            {defenseMode && currentStep?.rotationIndex && currentStep.attackOrigin && currentStep.defenseKind
              ? `${getSetterPositionLabel(currentStep.rotationIndex)} - ${DEFENSE_ATTACK_ORIGIN_LABELS[currentStep.attackOrigin]} / ${DEFENSE_KIND_LABELS[currentStep.defenseKind]}`
              : rotationPhaseMode && currentStep?.rotationIndex && currentStep.phase
              ? `${getSetterPositionLabel(currentStep.rotationIndex)} - ${phaseLabel[currentStep.phase]}`
              : `Passo ${stepIndex + 1} de ${steps.length}`}
          </Text>
        </View>
      </View>

      {defenseMode && currentStep?.rotationIndex && currentStep.attackOrigin && currentStep.defenseKind ? (
        <>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>
              Posição do levantador
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {rotations.map((rotation) => (
                <SegmentButton
                  key={rotation}
                  label={getSetterPositionLabel(rotation)}
                  active={currentStep.rotationIndex === rotation}
                  onPress={() =>
                    selectDefenseStep(
                      rotation,
                      currentStep.attackOrigin!,
                      currentStep.defenseKind!
                    )
                  }
                />
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>
              Origem do ataque adversário
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DEFENSE_ATTACK_ORIGIN_ORDER.map((origin) => (
                <SegmentButton
                  key={origin}
                  label={DEFENSE_ATTACK_ORIGIN_LABELS[origin]}
                  active={currentStep.attackOrigin === origin}
                  onPress={() =>
                    selectDefenseStep(
                      currentStep.rotationIndex!,
                      origin,
                      currentStep.defenseKind!
                    )
                  }
                />
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>
              Ajuste defensivo
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DEFENSE_KIND_ORDER.map((kind) => (
                <SegmentButton
                  key={kind}
                  label={DEFENSE_KIND_LABELS[kind]}
                  active={currentStep.defenseKind === kind}
                  onPress={() =>
                    selectDefenseStep(
                      currentStep.rotationIndex!,
                      currentStep.attackOrigin!,
                      kind
                    )
                  }
                />
              ))}
            </View>
          </View>
        </>
      ) : rotationPhaseMode && currentStep?.rotationIndex && currentStep.phase ? (
        <>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>
              Posição do levantador
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {rotations.map((rotation) => (
                <SegmentButton
                  key={rotation}
                  label={getSetterPositionLabel(rotation)}
                  active={currentStep.rotationIndex === rotation}
                  onPress={() => selectRotationPhase(rotation, currentStep.phase!)}
                />
              ))}
            </View>
          </View>
          {phases.length > 1 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>
                Momento
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {phases.map((phase) => {
                  const isAvailable = steps.some(
                    (step) =>
                      step.rotationIndex === currentStep.rotationIndex &&
                      step.phase === phase
                  );
                  if (!isAvailable) return null;
                  return (
                    <SegmentButton
                      key={phase}
                      label={phaseLabel[phase]}
                      active={currentStep.phase === phase}
                      onPress={() => selectRotationPhase(currentStep.rotationIndex!, phase)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {steps.map((step, index) => (
            <SegmentButton
              key={step.id}
              label={String(index + 1)}
              active={stepIndex === index}
              onPress={() => onSelectStep(index)}
            />
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>
          Velocidade
        </Text>
        {speedOptions.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => onSetSpeed(option)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: speed === option ? colors.primaryBg : colors.border,
              backgroundColor: speed === option ? colors.primaryBg : colors.secondaryBg,
            }}
          >
            <Text
              style={{
                color: speed === option ? colors.primaryText : colors.text,
                fontSize: 12,
                fontWeight: "900",
              }}
            >
              {option}x
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? colors.primaryBg : colors.border,
        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
      }}
    >
      <Text
        style={{
          color: active ? colors.primaryText : colors.text,
          fontSize: 12,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: GoAtletaIconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 42,
        height: 42,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <GoAtletaIcon name={icon} size={19} color={colors.text} />
    </Pressable>
  );
}
