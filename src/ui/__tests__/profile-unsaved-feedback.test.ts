import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");

describe("profile unsaved feedback", () => {
  const source = fs.readFileSync(path.join(repoRoot, "app/profile.tsx"), "utf8");

  it("switches cards without confirming or discarding the shared draft", () => {
    const toggle = source.slice(source.indexOf("const toggleMobileSection"), source.indexOf("const leaveMobileProfile"));
    expect(toggle).toContain("setMobileExpandedSection");
    expect(toggle).not.toContain("confirm(");
    expect(toggle).not.toContain(".discard()");
  });

  it("shows modality saving only in a dirty floating bar without overlapping personal save", () => {
    expect(source.match(/<FloatingSaveBar/g)).toHaveLength(1);
    expect(source).toContain('(mobileProfileHasChanges || mobileSportsHasChanges || athleteModalities.dirty)');
    expect(source).not.toContain('<Button label={athleteModalities.saving');
    expect(source).toContain('loading={savingMobileProfile || athleteModalities.saving}');
    expect(source).not.toContain(': "Salvar posições"');
  });

  it("does not show a warning toast merely because a field was edited", () => {
    expect(source).not.toContain("previousMobileDirtyRef");
    expect(source).not.toContain('message: "Você tem alterações não salvas.",');
  });

  it("still confirms before abandoning an edited profile", () => {
    expect(source).toContain('title: "Sair sem salvar?"');
    expect(source).toContain('message: "Você tem alterações não salvas no perfil."');
    expect(source).toContain('window.addEventListener("beforeunload", handleBeforeUnload)');
    expect(source).toContain('confirmLabel: "Descartar alterações"');
    expect(source).toContain('setMobileGuardianNameDraft(mobileProfileBaseline.guardianName)');
    expect(source).toContain('setMobileHealthObservationsDraft(mobileSportsBaseline.healthObservations)');
    expect(source).toContain('athleteModalities.discard()');
    expect(source).toContain('onBack={() => leaveMobileProfile()}');
    expect(source).not.toContain('onBack={leaveMobileProfile}');
  });

  it("reveals the unsaved guardian card after continuing and clears its hint on edits", () => {
    expect(source).toContain('pendingMessage={pendingNoticeFor("guardian")}');
    expect(source).toContain('setMobileExpandedSection(section)');
    expect(source).toContain('pendingProfileNotice?.[section]?.snapshot === pendingCardSnapshot(section)');
    expect(source).toContain('Object.entries(pendingCardFields)');
    expect(source).toContain('`Não salvo: ${changed.join(", ")}.`');
    expect(source).toContain('bottom={responsiveLayout.isMobile ? insets.bottom + 104 : 18}');
  });

  it("shows the web save action as a floating control only after a real edit", () => {
    expect(source).toContain('import { FloatingSaveBar } from "../src/ui/FloatingSaveBar";');
    expect(source).toContain('Platform.OS === "web"');
    expect(source).toContain('mobileExpandedSection === "personal"');
    expect(source).toContain('(mobileProfileHasChanges || mobileSportsHasChanges || athleteModalities.dirty)');
    expect(source).toContain('? "Preencha os dados obrigatórios"');
    expect(source).toContain(': "Salvar alterações"}');
  });

  it("keeps verified phone state tied to the visible value and removes it inside the field", () => {
    expect(source).toContain("student?.phone || authenticatedPhone");
    expect(source).toContain("const isDisplayedPhoneVerified = Boolean(");
    expect(source).toContain('accessibilityLabel="Remover número de celular"');
    expect(source).toContain('<GoAtletaIcon name="trash"');
    expect(source).toContain('"O número atual será desvinculado da conta. Depois, você poderá cadastrar outro."');
  });

  it("uses the shared responsive profile sections for the professional profile", () => {
    expect(source).toContain('title="Perfil profissional"');
    expect(source).toContain('title="Preferências"');
    expect(source).toContain('title="Conta e segurança"');
    expect(source).toContain('title="Integrações"');
    expect(source).toContain('label: "Turmas acessíveis"');
    expect(source).toContain("professionalUnits.map");
    expect(source).toContain('<ProfileToggle enabled={notificationsEnabled} />');
    expect(source).toContain('<ProfileToggle enabled={mode === "dark"} />');
  });

  it("uses the professional responsive grid for the student profile", () => {
    const studentProfile = source.slice(
      source.indexOf("{isStudentMobileProfile ? ("),
      source.indexOf('title="Perfil"', source.indexOf("{isStudentMobileProfile ? (")),
    );

    expect(studentProfile).toContain('<ResponsiveGrid columns={{ compact: "1", split: "4/8" }} gap={24}>');
    expect(studentProfile).toContain('key="student-identity"');
    expect(studentProfile).toContain('key="student-settings"');
    expect(studentProfile).not.toContain("maxWidth: responsiveLayout.isMobile ? undefined : 760");
  });

  it("makes the student completion requirements explicit before saving", () => {
    expect(source).toContain("Nome, celular, data de nascimento e CPF são obrigatórios. Os demais dados são opcionais.");
    expect(source).toContain('message: "Revise os campos obrigatórios destacados."');
    expect(source).toContain("mobileRequiredValidationAttempted && mobileProfileHasRequiredErrors");
    expect(source).toContain('"Preencha os dados obrigatórios"');
    expect(source).toContain("validateCpf(mobileCpfDraft)");
    expect(source).toContain("<FloatingFieldError message={fieldError} />");
    expect(source).toContain("setMobileExpandedSection(\"personal\")");
    expect(source).not.toContain('Alert.alert(\n        "Complete os dados obrigatórios"');
  });
});
