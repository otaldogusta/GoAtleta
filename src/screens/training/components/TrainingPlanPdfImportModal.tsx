import * as DocumentPicker from "expo-document-picker";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";

import { analyzeTrainingPlanPdf } from "../../../api/training-plan-pdf-import";
import type { TrainingPlan } from "../../../core/models";
import { PdfPreviewFrame } from "../../../pdf/PdfPreviewFrame";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import {
  buildPlanningDraftsFromPdfAnalysis,
  type PlanningPdfAnalysis,
} from "../application/training-plan-pdf-import";

const MAX_PDF_BYTES = 6 * 1024 * 1024;

type AnalysisStage = "idle" | "preparing" | "reading" | "organizing" | "waiting";

const ANALYSIS_STEPS = [
  { id: "preparing", label: "Preparar" },
  { id: "reading", label: "Ler páginas" },
  { id: "organizing", label: "Organizar" },
] as const;

const PDF_ANALYSIS_MOTION_STYLE_ID = "goatleta-pdf-analysis-motion";
const ANALYSIS_DOT_OFFSETS = [0.08, 0.3, 0.52] as const;
let pdfAnalysisMotionInjected = false;

const ensurePdfAnalysisWebMotion = () => {
  if (Platform.OS !== "web" || pdfAnalysisMotionInjected) return;
  const documentRef = (globalThis as unknown as {
    document?: {
      getElementById: (id: string) => unknown;
      createElement: (tagName: string) => { id: string; textContent: string | null };
      head?: { appendChild: (node: unknown) => void };
      body?: { appendChild: (node: unknown) => void };
    };
  }).document;
  if (!documentRef || documentRef.getElementById(PDF_ANALYSIS_MOTION_STYLE_ID)) {
    pdfAnalysisMotionInjected = true;
    return;
  }
  const styleElement = documentRef.createElement("style");
  styleElement.id = PDF_ANALYSIS_MOTION_STYLE_ID;
  styleElement.textContent = `
    @keyframes goatleta-pdf-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes goatleta-pdf-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.07); }
    }
    @keyframes goatleta-pdf-sweep {
      from { transform: translate3d(-100px, 0, 0); }
      to { transform: translate3d(370px, 0, 0); }
    }
    @keyframes goatleta-pdf-dot {
      0%, 55%, 100% { opacity: 0.28; transform: translate3d(0, 0, 0); }
      24% { opacity: 1; transform: translate3d(0, -2px, 0); }
    }
  `;
  (documentRef.head ?? documentRef.body)?.appendChild(styleElement);
  pdfAnalysisMotionInjected = true;
};

type Props = {
  visible: boolean;
  organizationId: string;
  onClose: () => void;
  onCreatePlans: (plans: TrainingPlan[]) => void | Promise<void>;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const readAssetBase64 = async (asset: DocumentPicker.DocumentPickerAsset) => {
  if (Platform.OS !== "web") {
    return readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
  }
  if (asset.base64) return String(asset.base64).replace(/^data:[^,]+,/, "");
  if (asset.file && typeof asset.file.arrayBuffer === "function") {
    return arrayBufferToBase64(await asset.file.arrayBuffer());
  }
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error("Não foi possível ler o PDF selecionado.");
  return arrayBufferToBase64(await response.arrayBuffer());
};

function PdfAnalysisProgress({
  filename,
  message,
  stage,
  colors,
}: {
  filename: string;
  message: string;
  stage: AnalysisStage;
  colors: {
    border: string;
    inputBg: string;
    muted: string;
    primaryBg: string;
    primaryText: string;
    text: string;
  };
}) {
  const isWeb = Platform.OS === "web";
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const messageEnter = useRef(new Animated.Value(1)).current;
  const activeStep = stage === "waiting"
    ? ANALYSIS_STEPS.length - 1
    : Math.max(0, ANALYSIS_STEPS.findIndex((step) => step.id === stage));

  useEffect(() => {
    if (isWeb) {
      ensurePdfAnalysisWebMotion();
      return undefined;
    }
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1_300,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1_650,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );
    spinLoop.start();
    pulseLoop.start();
    sweepLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      sweepLoop.stop();
    };
  }, [isWeb, pulse, spin, sweep]);

  useEffect(() => {
    messageEnter.setValue(0);
    Animated.timing(messageEnter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [message, messageEnter]);

  const ringRotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const iconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const sweepTranslate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 350],
  });
  const messageTranslate = messageEnter.interpolate({
    inputRange: [0, 1],
    outputRange: [5, 0],
  });
  const webSpinStyle = isWeb ? {
    animationName: "goatleta-pdf-spin",
    animationDuration: "1300ms",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    willChange: "transform",
  } as ViewStyle : null;
  const webPulseStyle = isWeb ? {
    animationName: "goatleta-pdf-pulse",
    animationDuration: "1700ms",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    willChange: "transform",
  } as ViewStyle : null;
  const webSweepStyle = isWeb ? {
    animationName: "goatleta-pdf-sweep",
    animationDuration: "1650ms",
    animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    animationIterationCount: "infinite",
    willChange: "transform",
  } as ViewStyle : null;

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ text: message }} style={styles.analysisProgress}>
      <View style={styles.analysisOrbWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.analysisRing,
            {
              borderColor: colors.border,
              borderTopColor: colors.primaryBg,
              ...(!isWeb ? { transform: [{ rotate: ringRotation }] } : null),
            },
            webSpinStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.analysisOrb,
            {
              ...(!isWeb ? { transform: [{ scale: iconScale }] } : null),
            },
            webPulseStyle,
          ]}
        >
          <GoAtletaIcon name="document" size={25} color={colors.primaryBg} />
        </Animated.View>
      </View>

      <Text numberOfLines={1} style={[styles.analysisFilename, { color: colors.text }]}>
        {filename || "Plano de aula em PDF"}
      </Text>
      <Animated.View
        style={[
          styles.analysisMessageRow,
          { opacity: messageEnter, transform: [{ translateY: messageTranslate }] },
        ]}
      >
        <Text accessibilityLiveRegion="polite" style={[styles.analysisStatus, { color: colors.muted }]}>
          {message}
        </Text>
        <View accessibilityElementsHidden style={styles.thinkingDots}>
          {ANALYSIS_DOT_OFFSETS.map((offset, index) => (
            <Animated.View
              key={offset}
              style={[
                styles.thinkingDot,
                {
                  backgroundColor: colors.primaryBg,
                  ...(!isWeb ? {
                    opacity: sweep.interpolate({
                      inputRange: [0, offset, Math.min(1, offset + 0.18), Math.min(1, offset + 0.36), 1],
                      outputRange: [0.28, 0.28, 1, 0.28, 0.28],
                    }),
                  } : null),
                },
                isWeb ? {
                  animationName: "goatleta-pdf-dot",
                  animationDuration: "1100ms",
                  animationDelay: `${index * 140}ms`,
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  willChange: "transform, opacity",
                } as ViewStyle : null,
              ]}
            />
          ))}
        </View>
      </Animated.View>

      <View style={[styles.analysisTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.analysisSweep,
            {
              backgroundColor: colors.primaryBg,
              ...(!isWeb ? { transform: [{ translateX: sweepTranslate }] } : null),
            },
            webSweepStyle,
          ]}
        />
      </View>

      <View style={styles.analysisSteps}>
        {ANALYSIS_STEPS.map((step, index) => {
          const completed = index < activeStep;
          const active = index === activeStep;
          return (
            <View key={step.id} style={styles.analysisStep}>
              <View
                style={[
                  styles.analysisStepDot,
                  {
                    backgroundColor: completed || active ? colors.primaryBg : "transparent",
                    borderColor: completed || active ? colors.primaryBg : colors.border,
                  },
                ]}
              >
                {completed ? <GoAtletaIcon name="success" size={10} color={colors.primaryText} /> : null}
              </View>
              <Text style={[styles.analysisStepLabel, { color: active ? colors.text : colors.muted }]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function TrainingPlanPdfImportModal({
  visible,
  organizationId,
  onClose,
  onCreatePlans,
}: Props) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [analysis, setAnalysis] = useState<PlanningPdfAnalysis | null>(null);
  const [busy, setBusy] = useState<"analyzing" | "opening" | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("idle");
  const [analysisFilename, setAnalysisFilename] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) return;
    setAnalysis(null);
    setPreviewUrl("");
    setAnalysisFilename("");
    setAnalysisMessage("");
    setAnalysisStage("idle");
    setError("");
    setBusy(null);
  }, [visible]);

  const pickAndAnalyze = async () => {
    const progressTimers: Array<ReturnType<typeof setTimeout>> = [];
    const stopProgressTimers = () => progressTimers.forEach((timer) => clearTimeout(timer));
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
        type: "application/pdf",
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error("Arquivo inválido.");
      const filename = String(asset.name ?? "plano-de-aula.pdf").trim();
      const mimeType = String(asset.mimeType ?? "application/pdf").toLowerCase();
      if (!filename.toLowerCase().endsWith(".pdf") || mimeType !== "application/pdf") {
        throw new Error("Selecione um arquivo PDF válido.");
      }
      if (Number(asset.size ?? 0) > MAX_PDF_BYTES) {
        throw new Error("O PDF deve ter no máximo 6 MB.");
      }
      setAnalysis(null);
      setPreviewUrl(asset.uri);
      setBusy("analyzing");
      setAnalysisFilename(filename);
      setAnalysisStage("preparing");
      setAnalysisMessage("Preparando o PDF...");
      progressTimers.push(setTimeout(() => {
        setAnalysisStage("reading");
        setAnalysisMessage("Lendo texto e imagem das páginas...");
      }, 2_500));
      progressTimers.push(setTimeout(() => {
        setAnalysisStage("organizing");
        setAnalysisMessage("Identificando e organizando os planos...");
      }, 10_000));
      const base64 = await readAssetBase64(asset);
      if (!base64.startsWith("JVBERi0")) {
        throw new Error("A assinatura do arquivo não corresponde a um PDF válido.");
      }
      const nextAnalysis = await analyzeTrainingPlanPdf(
        {
          organizationId,
          filename,
          mimeType,
          base64,
        },
        {
          onRetry: ({ code, attempt, retryAfterSeconds }) => {
            stopProgressTimers();
            setAnalysisStage("waiting");
            setAnalysisMessage(
              code === "ANALYSIS_IN_PROGRESS"
                ? "Aguardando a análise que já está em andamento..."
                : `Limite temporário. Nova tentativa ${attempt} em ${retryAfterSeconds}s...`
            );
          },
        }
      );
      setAnalysis(nextAnalysis);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível analisar o PDF.");
    } finally {
      stopProgressTimers();
      setBusy(null);
      setAnalysisStage("idle");
      setAnalysisMessage("");
    }
  };

  const openInEditor = async () => {
    if (!analysis) return;
    setError("");
    setBusy("opening");
    try {
      const drafts = buildPlanningDraftsFromPdfAnalysis({ analysis });
      if (!drafts.length) throw new Error("Nenhum plano pôde ser aberto no editor.");
      await onCreatePlans(drafts);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar o rascunho.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={busy ? () => undefined : onClose}
      position="center"
      containerPadding={width < 600 ? 10 : 20}
      cardStyle={[
        styles.card,
        {
          width: Math.min(width - (width < 600 ? 20 : 40), 1100),
          maxHeight: Math.min(height - 40, 820),
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={[styles.headerIcon, { backgroundColor: colors.successBg }]}>
          <GoAtletaIcon name="upload" size={20} color={colors.primaryBg} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Importar plano em PDF</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Abra o documento como rascunho editável.</Text>
        </View>
        <Pressable
          onPress={busy ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar importação"
          style={[styles.closeButton, { borderColor: colors.border }]}
        >
          <GoAtletaIcon name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      {!previewUrl ? (
        <View style={styles.emptyState}>
          <View style={[styles.dropZone, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
            <GoAtletaIcon name="document" size={28} color={colors.primaryBg} />
            <Pressable
              onPress={pickAndAnalyze}
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: colors.primaryBg }]}
            >
              <GoAtletaIcon name="upload" size={17} color={colors.primaryText} />
              <Text style={[styles.primaryLabel, { color: colors.primaryText }]}>Selecionar PDF</Text>
            </Pressable>
            <Text style={[styles.limitText, { color: colors.muted }]}>PDF · até 6 MB</Text>
          </View>
          {error ? <Text style={[styles.errorText, { color: colors.dangerText }]}>{error}</Text> : null}
        </View>
      ) : (
        <>
          <View style={[styles.contextBar, { borderBottomColor: colors.border }]}>
            <View style={styles.contextCopy}>
              <Text numberOfLines={1} style={[styles.contextTitle, { color: colors.text }]}>{analysis?.filename || analysisFilename}</Text>
              <Text style={[styles.contextMeta, { color: colors.muted }]}>
                {analysis
                  ? `${analysis.processing?.pageCount || analysis.plans.length} ${analysis.processing?.pageCount === 1 ? "página" : "páginas"} · Pronto para editar`
                  : "Preparando o documento"}
              </Text>
            </View>
            <Pressable onPress={busy ? undefined : pickAndAnalyze} style={[styles.replaceButton, { borderColor: colors.border }]}>
              <Text style={[styles.replaceLabel, { color: colors.text }]}>Trocar arquivo</Text>
            </Pressable>
          </View>

          <View style={[styles.previewArea, { height: Math.max(280, Math.min(height - 250, 620)), backgroundColor: colors.inputBg }]}>
            <PdfPreviewFrame url={previewUrl} title={analysis?.filename || analysisFilename || "Prévia do PDF"} />
            {busy === "analyzing" ? (
              <View style={[styles.analysisOverlay, { backgroundColor: `${colors.card}F2` }]}>
                <PdfAnalysisProgress
                  filename={analysisFilename}
                  message={analysisMessage || "Preparando o PDF..."}
                  stage={analysisStage}
                  colors={colors}
                />
              </View>
            ) : null}
          </View>

          {error ? <Text style={[styles.errorText, styles.footerError, { color: colors.dangerText }]}>{error}</Text> : null}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Text style={[styles.footerNote, { color: colors.muted }]}>A turma será escolhida somente ao adicionar o plano.</Text>
            <Pressable
              onPress={analysis && !busy ? openInEditor : undefined}
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: colors.primaryBg, opacity: analysis && !busy ? 1 : 0.55 }]}
            >
              {busy === "opening" ? <ActivityIndicator size="small" color={colors.primaryText} /> : <GoAtletaIcon name="document" size={17} color={colors.primaryText} />}
              <Text style={[styles.primaryLabel, { color: colors.primaryText }]}>{busy === "opening" ? "Abrindo..." : "Abrir no editor"}</Text>
            </Pressable>
          </View>
        </>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: "visible", minHeight: 320 },
  header: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  headerIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: "900" },
  subtitle: { marginTop: 2, fontSize: 12 },
  closeButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  emptyState: { padding: 18, gap: 10 },
  dropZone: { minHeight: 245, padding: 22, borderWidth: 1, borderStyle: "dashed", borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 10 },
  primaryButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryLabel: { fontSize: 12, fontWeight: "900" },
  limitText: { fontSize: 10, fontWeight: "700" },
  analysisStatus: { maxWidth: 460, fontSize: 11, lineHeight: 16, textAlign: "center", fontWeight: "700" },
  analysisProgress: { width: "100%", maxWidth: 470, alignItems: "center", justifyContent: "center", gap: 10 },
  analysisOrbWrap: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  analysisRing: { position: "absolute", width: 70, height: 70, borderRadius: 35, borderWidth: 2 },
  analysisOrb: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  analysisFilename: { width: "100%", maxWidth: 390, paddingHorizontal: 16, fontSize: 14, lineHeight: 19, fontWeight: "900", textAlign: "center" },
  analysisMessageRow: { minHeight: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  thinkingDots: { flexDirection: "row", alignItems: "center", gap: 3 },
  thinkingDot: { width: 4, height: 4, borderRadius: 2 },
  analysisTrack: { width: "82%", maxWidth: 360, height: 4, borderRadius: 999, overflow: "hidden", opacity: 0.9 },
  analysisSweep: { width: 90, height: 4, borderRadius: 999 },
  analysisSteps: { width: "100%", maxWidth: 390, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 },
  analysisStep: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  analysisStepDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  analysisStepLabel: { flexShrink: 1, fontSize: 10, fontWeight: "800" },
  errorText: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  contextBar: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  contextCopy: { flex: 1, minWidth: 0 },
  contextTitle: { fontSize: 13, fontWeight: "900" },
  contextMeta: { marginTop: 2, fontSize: 11 },
  replaceButton: { minHeight: 34, paddingHorizontal: 11, borderWidth: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  replaceLabel: { fontSize: 11, fontWeight: "800" },
  previewArea: { position: "relative", minHeight: 280, overflow: "hidden" },
  analysisOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 24 },
  reviewScroll: { minHeight: 0, flexGrow: 0 },
  reviewContent: { padding: 16, gap: 14 },
  warningBox: { padding: 11, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  warningText: { flex: 1, fontSize: 11, lineHeight: 16 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "900" },
  sectionSubtitle: { marginTop: 2, fontSize: 11 },
  counter: { fontSize: 12, fontWeight: "900" },
  plansList: { gap: 12 },
  planCard: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  planHeader: { minHeight: 62, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  planHeaderCopy: { flex: 1, minWidth: 0 },
  planTitle: { fontSize: 13, fontWeight: "900" },
  planMeta: { marginTop: 3, fontSize: 10, lineHeight: 14 },
  planWarning: { paddingHorizontal: 12, paddingBottom: 10, fontSize: 10, lineHeight: 14 },
  itemsCard: { borderTopWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  itemRow: { minHeight: 92, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 1 },
  itemCopy: { flex: 1, minWidth: 0, gap: 3 },
  itemTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  itemLabel: { flex: 1, fontSize: 12, fontWeight: "900" },
  confidence: { fontSize: 10, fontWeight: "900" },
  proposedValue: { fontSize: 12, lineHeight: 17 },
  currentValue: { fontSize: 10, lineHeight: 14 },
  evidence: { fontSize: 9, fontWeight: "700" },
  footerError: { paddingHorizontal: 16, paddingTop: 8 },
  footer: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  footerNote: { flex: 1, minWidth: 150, fontSize: 10 },
});
