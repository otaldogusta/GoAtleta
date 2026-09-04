import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const studentsListSource = readFileSync(
  resolve(__dirname, "../StudentsListTab.tsx"),
  "utf8",
);
const panelsSource = readFileSync(
  resolve(__dirname, "../components/StudentFamilyAccessPanels.tsx"),
  "utf8",
);
const filterBarSource = readFileSync(
  resolve(__dirname, "../components/StudentDirectoryFilterBar.tsx"),
  "utf8",
);
const studentEditModalSource = readFileSync(
  resolve(__dirname, "../modals/StudentEditModal.tsx"),
  "utf8",
);
const studentsScreenSource = readFileSync(
  resolve(__dirname, "../../../../app/students/index.tsx"),
  "utf8",
);
const financeDashboardSource = readFileSync(
  resolve(__dirname, "../../finance/CoordinationFinanceDashboard.tsx"),
  "utf8",
);
const coordinationSource = readFileSync(
  resolve(__dirname, "../../coordination/CoordinationPeopleWorkspace.tsx"),
  "utf8",
);
const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../../supabase/migrations/20260903174500_update_student_family_relationship.sql",
  ),
  "utf8",
);

describe("student family access integration", () => {
  test("keeps one row-scoped access surface and switches by viewport capacity", () => {
    expect(studentsListSource).toContain('mode: "quick" | "drawer"');
    expect(studentsListSource).toContain("<StudentFamilyAccessPanels");
    expect(panelsSource).toContain('position={compact ? "bottom" : "right"}');
    expect(panelsSource).toContain("<AnchoredDropdown");
    expect(panelsSource).toContain("preferredWidth={350}");
    expect(panelsSource).toContain(
      "interactiveRefs={[relationshipTriggerRef]}",
    );
    expect(panelsSource).toContain("portalToBodyOnWeb");
  });

  test("keeps the family composer open while access data refreshes", () => {
    expect(panelsSource).toContain("const studentId = student?.id ?? null;");
    expect(panelsSource).toContain("}, [mode, studentId]);");
    expect(panelsSource).toContain('if (mode === "drawer") void loadAccess();');
  });

  test("shows linked operational badges instead of manual finance selectors", () => {
    expect(studentEditModalSource).toContain('title="Financeiro"');
    expect(studentEditModalSource).toContain('title="Frequência"');
    expect(studentEditModalSource).toContain("Histórico");
    expect(studentEditModalSource).toContain("OperationalIndicatorBadge");
    expect(studentEditModalSource).toContain("onOpenFinance");
    expect(studentEditModalSource).not.toContain(
      'accessibilityRole="radiogroup"',
    );
    expect(studentEditModalSource).not.toContain(
      "financialStatus: option.value",
    );
    expect(studentsScreenSource).toContain("listOrganizationInvoices");
    expect(studentsScreenSource).toContain("getAttendanceByStudent");
    expect(studentsScreenSource).toContain("deriveStudentFinanceIndicator");
    expect(studentsScreenSource).toContain("deriveStudentAttendanceIndicator");
    expect(financeDashboardSource).toContain("linkedStudentFilterId");
    expect(financeDashboardSource).toContain("requestedStudentName");
  });

  test("keeps operational states side by side and edits only membership through an overlay menu", () => {
    expect(studentEditModalSource).toContain("operationalStyles.strip");
    expect(studentEditModalSource).toContain("responsiveLayout.isMobile");
    expect(studentEditModalSource).toContain("<AnchoredDropdown");
    expect(studentEditModalSource).toContain("portalToBodyOnWeb");
    expect(studentEditModalSource).toContain("selectMembershipStatus(\"active\")");
    expect(studentEditModalSource).toContain("selectMembershipStatus(\"inactive\")");
    expect(studentEditModalSource).toContain("membershipIndicator.label");
    expect(studentEditModalSource).toContain("operationalStyles.modalHeaderActions");
    expect(studentEditModalSource).toContain("colors.primaryText");
    expect(studentEditModalSource).toContain('accessibilityHint="Mostra o motivo do aviso"');
    expect(studentEditModalSource).toContain("showReason={attendanceIndicator.tone");
    expect(studentEditModalSource).toContain("onHoverIn");
    expect(studentEditModalSource).toContain("onHoverOut");
    expect(studentEditModalSource).toContain("interactiveRefs={[reasonTriggerRef]}");
    expect(studentEditModalSource).toContain("zIndex={overlayLayers.floatingList}");
    expect(studentEditModalSource).not.toContain("operationalStyles.badgeTooltip");
    expect(studentEditModalSource).not.toContain("membershipIndicator.detail");
    expect(studentEditModalSource).not.toContain("Disponível em turmas e chamadas</Text>");
    expect(studentEditModalSource).not.toContain("Fora das novas chamadas</Text>");
    expect(studentEditModalSource).not.toContain("Reativar aluno");
    expect(studentEditModalSource).not.toContain("Inativar aluno");
  });

  test("opens a read-only finance summary before navigating away from the student", () => {
    const summarySource = readFileSync(resolve(__dirname, "../components/StudentFinanceSummaryPopover.tsx"), "utf8");
    expect(studentEditModalSource).toContain("onPress={openFinanceSummary}");
    expect(studentEditModalSource).toContain("<StudentFinanceSummaryPopover");
    expect(studentEditModalSource).toContain('activeOperationalOverlay === "finance"');
    expect(studentsScreenSource).toContain("deriveStudentFinanceSummary(studentInvoices)");
    expect(studentsScreenSource).toContain("invoice.studentId === operationalStudentId");
    expect(studentsScreenSource).toContain("setStudentFinanceSummary(null)");
    expect(studentsScreenSource).toContain("requestId !== operationalIndicatorsRequestIdRef.current");
    expect(summarySource).toContain("portalToBodyOnWeb");
    expect(summarySource).toContain("Saldo em aberto");
    expect(summarySource).toContain("Última cobrança");
    expect(summarySource).toContain("Nenhuma cobrança para este aluno.");
    expect(summarySource).toContain('accessibilityLabel="Abrir financeiro completo do aluno"');
    expect(summarySource).not.toContain("TextInput");
  });

  test("matches the approved athlete directory filters and list hierarchy", () => {
    expect(filterBarSource).toContain('label="Turma"');
    expect(filterBarSource).toContain('label="Status"');
    expect(filterBarSource).toContain('label="Responsável / acesso"');
    expect(filterBarSource).toContain("Limpar filtros");
    expect(filterBarSource).toContain("Filtros");
    expect(studentsListSource).toContain("RESPONSÁVEL / CONTATO");
    expect(studentsListSource).toContain("Adicionar responsável");
    expect(studentsListSource).toContain("Acesso ativo");
    expect(studentsListSource).toContain("Convite enviado");
    expect(migrationSource).toContain(
      "list_student_family_access_summaries_v1",
    );
  });

  test("removes the duplicate family directory entry from coordination", () => {
    expect(coordinationSource).not.toContain("CoordinationFamilyAccessScreen");
    expect(coordinationSource).not.toContain("Gerenciar acessos familiares");
  });

  test("confirms destructive operations and authorizes relationship edits server-side", () => {
    expect(panelsSource).toContain('title: "Revogar acesso?"');
    expect(panelsSource).toContain('title: "Cancelar convite?"');
    expect(panelsSource).toContain('item.kind !== "athlete"');
    expect(panelsSource).toContain('item.relationshipKind !== "athlete"');
    expect(migrationSource).toContain("public.can_manage_student_invites");
    expect(migrationSource).toContain("ATHLETE_RELATIONSHIP_IMMUTABLE");
    expect(migrationSource).toContain("to authenticated");
  });
});
