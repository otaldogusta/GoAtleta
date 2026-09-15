import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { findPostalAddress } from "../api/postal-address";
import { useAppTheme } from "./app-theme";
import { Button } from "./Button";
import { useResponsiveLayout } from "./use-responsive-layout";

export function PostalAddressField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { colors } = useAppTheme();
  const { isMobile } = useResponsiveLayout("content");
  const [cep, setCep] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!suggestion) return;
    const parts = suggestion.split(", ");
    const street = parts.shift();
    onChange([street, number.trim(), complement.trim(), ...parts].filter(Boolean).join(", "));
  }, [suggestion, number, complement, onChange]);
  const search = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setSuggestion("");
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const address = await findPostalAddress(cep, controller.signal);
      if (request.current === controller) setSuggestion(address);
    } catch (cause) {
      if (request.current === controller) setError(controller.signal.aborted
        ? "A busca demorou. Tente novamente ou preencha manualmente."
        : cause instanceof Error ? cause.message : "Não foi possível buscar o CEP.");
    } finally {
      clearTimeout(timer);
      if (request.current === controller) setBusy(false);
    }
  }, [cep]);
  useEffect(() => {
    if (cep.replace(/\D/g, "").length !== 8) return;
    const delay = setTimeout(() => void search(), 350);
    return () => {
      clearTimeout(delay);
      request.current?.abort();
      request.current = null;
    };
  }, [cep, search]);
  const container = { minHeight: 50, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, justifyContent: "center" as const };
  const input = { color: colors.text, fontSize: 15, borderRadius: 0, paddingVertical: 0 };
  const addressInput = (
    <View style={container}>
      <TextInput accessibilityLabel="Endereço" value={value} onChangeText={onChange}
        placeholder="Rua, número, complemento, bairro e cidade" placeholderTextColor={colors.muted} style={input} />
    </View>
  );
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>Endereço</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
        <View style={{ flexGrow: 1, flexBasis: 140, minWidth: 0, gap: 7 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>CEP</Text>
        <View style={container}>
          <TextInput accessibilityLabel="CEP" placeholder="CEP" placeholderTextColor={colors.muted}
            keyboardType="number-pad" maxLength={9} value={cep} style={input}
            onChangeText={(next) => {
              request.current?.abort();
              request.current = null;
              setBusy(false);
              setError("");
              setSuggestion("");
              const digits = next.replace(/\D/g, "").slice(0, 8);
              setCep(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
            }} />
        </View>
        {busy ? <ActivityIndicator accessibilityLabel="Consultando CEP" size="small" color={colors.primaryBg} /> : null}
        </View>
        <View style={{ flexGrow: 1, flexBasis: 120, minWidth: 0, gap: 7 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Número</Text>
        <View style={container}>
          <TextInput accessibilityLabel="Número do endereço" placeholder="Ex.: 123 ou s/n" placeholderTextColor={colors.muted}
            value={number} onChangeText={setNumber} maxLength={30} style={input} />
        </View>
        </View>
        {isMobile ? <View style={{ width: "100%", gap: 7 }}>{addressInput}</View> : null}
        <View style={{ flexGrow: 2, flexBasis: isMobile ? "100%" : 200, minWidth: 0, gap: 7 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Complemento (opcional)</Text>
        <View style={container}>
          <TextInput accessibilityLabel="Complemento do endereço" placeholder="Apartamento, bloco, casa dos fundos..."
            placeholderTextColor={colors.muted} value={complement} onChangeText={setComplement} maxLength={120} style={input} />
        </View>
        </View>
      </View>
      {error ? <View style={{ gap: 7 }}>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.dangerText, fontSize: 12 }}>{error}</Text>
        <Button label="Tentar novamente" variant="ghost" onPress={() => void search()} disabled={busy} />
      </View> : null}
      {!isMobile ? addressInput : null}
    </View>
  );
}
