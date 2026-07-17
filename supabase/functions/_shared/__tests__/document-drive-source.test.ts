import {
  DRIVE_AUTH_STRATEGIES,
  DRIVE_SOURCE_PROFILES,
  assertSafeGoogleDriveFetchUrl,
  classifyDriveFolderRole,
  documentTypeForFolderRole,
  isDriveAuthStrategy,
  parseConfiguredDriveSourceProfiles,
  resolveAllowedDriveSource,
  resolveDriveDocumentDate,
  resolveDriveMonth,
  resolveDriveSourceProfile,
  resolveExplicitClassBinding,
  resolveSafeGoogleDriveRedirect,
} from "../document-drive-source.ts";

const ACADEMIC_FOLDER_ID = "1TtqVOgnLXeDqvGr6885s-KABA4tsJ5QE";
const OPERATIONAL_FOLDER_ID = "1OperationalFolderConfigured123456";

describe("document Drive source profiles", () => {
  test("mantém a taxonomia canônica de perfis e tipos documentais", () => {
    expect(DRIVE_SOURCE_PROFILES).toEqual([
      "academic",
      "institutional_actions",
      "monthly_plan",
      "report",
      "lesson_plan",
      "unknown",
    ]);
    expect(DRIVE_AUTH_STRATEGIES).toEqual([
      "auto",
      "api_key",
      "oauth_user",
      "service_account",
    ]);
    expect(isDriveAuthStrategy("oauth_user")).toBe(true);
    expect(documentTypeForFolderRole("academic")).toBe("academic_support");
    expect(documentTypeForFolderRole("institutional_actions")).toBe(
      "institutional_guidance",
    );
    expect(documentTypeForFolderRole("monthly_plan")).toBe("monthly_plan");
  });

  test("preserva a pasta acadêmica pessoal sem vínculo com turma", () => {
    const policy = resolveDriveSourceProfile({});

    expect(policy).toMatchObject({
      sourceProfile: "academic",
      academicScope: "user",
      connectionScope: "user_academic",
      sourceScope: "user_academic",
      classBindingAllowed: false,
      minimumRoleLevel: 10,
    });
    expect(() =>
      resolveExplicitClassBinding({
        policy,
        classId: "class-1",
        classBindingConfirmed: true,
      }),
    ).toThrow(/acadêmicas/);
  });

  test("mapeia fontes operacionais para os escopos documentais existentes", () => {
    expect(
      resolveDriveSourceProfile({ sourceProfile: "institutional_actions" }),
    ).toMatchObject({
      connectionScope: "workspace",
      sourceScope: "workspace_institutional",
      minimumRoleLevel: 40,
    });
    expect(
      resolveDriveSourceProfile({ sourceProfile: "monthly_plan" }),
    ).toMatchObject({
      connectionScope: "workspace",
      sourceScope: "class_planning",
    });
    expect(
      resolveDriveSourceProfile({ sourceProfile: "report" }),
    ).toMatchObject({
      connectionScope: "workspace",
      sourceScope: "class_history",
    });
  });

  test("exige confirmação explícita antes de aceitar classId", () => {
    const policy = resolveDriveSourceProfile({
      sourceProfile: "monthly_plan",
    });

    expect(() =>
      resolveExplicitClassBinding({
        policy,
        classId: "class-1",
        classBindingConfirmed: false,
      }),
    ).toThrow(/confirmação explícita/);
    expect(
      resolveExplicitClassBinding({
        policy,
        classId: "class-1",
        classBindingConfirmed: true,
      }),
    ).toEqual({ classId: "class-1", status: "confirmed" });
  });

  test.each([
    [["JULHO"], { monthNumber: 7, monthKey: "07", year: null }],
    [["07 - Julho"], { monthNumber: 7, monthKey: "07", year: null }],
    [
      ["Planejamento 2026", "Julho"],
      { monthNumber: 7, monthKey: "2026-07", year: 2026 },
    ],
    [["2026-07"], { monthNumber: 7, monthKey: "2026-07", year: 2026 }],
    [
      ["Relatório 09/07/2026"],
      { monthNumber: 7, monthKey: "2026-07", year: 2026 },
    ],
    [["Relatório 09-07"], { monthNumber: 7, monthKey: "07", year: null }],
    [["MARÇO"], { monthNumber: 3, monthKey: "03", year: null }],
  ])("normaliza mês em %j", (values, expected) => {
    expect(resolveDriveMonth(values)?.monthNumber).toBe(expected.monthNumber);
    expect(resolveDriveMonth(values)?.monthKey).toBe(expected.monthKey);
    expect(resolveDriveMonth(values)?.year).toBe(expected.year);
  });

  test.each([
    [["Relatório 09/07/2026"], "2026-07-09"],
    [["Aula 2026-07-16"], "2026-07-16"],
    [["Plano 9-7-26"], "2026-07-09"],
    [["Pasta", "Data: 31.12.2026"], "2026-12-31"],
  ])("normaliza a data completa do documento %j", (values, expected) => {
    expect(resolveDriveDocumentDate(values)?.dateKey).toBe(expected);
  });

  test.each([
    [["JULHO"]],
    [["Relatório 09-07"]],
    [["Data: 31/02/2026"]],
    [["2026-13-10"]],
  ])("não inventa data completa para %j", (values) => {
    expect(resolveDriveDocumentDate(values)).toBeNull();
  });

  test("classifica o papel por arquivo sem perder o perfil raiz", () => {
    expect(
      classifyDriveFolderRole({
        sourceProfile: "monthly_plan",
        name: "Relatório de 09-07.docx",
        path: ["JULHO"],
      }),
    ).toBe("report");
    expect(
      classifyDriveFolderRole({
        sourceProfile: "unknown",
        name: "Ações - Primeiros Saques",
        path: ["Rede Esperança"],
      }),
    ).toBe("institutional_actions");
    expect(
      classifyDriveFolderRole({
        sourceProfile: "monthly_plan",
        name: "Semana 2",
        path: ["JULHO"],
      }),
    ).toBe("monthly_plan");
    expect(
      classifyDriveFolderRole({
        sourceProfile: "academic",
        name: "Relatório científico.pdf",
        path: ["Faculdade"],
      }),
    ).toBe("academic");
  });

  test("autoriza apenas perfis previamente configurados para cada folderId", () => {
    const configuredProfiles = parseConfiguredDriveSourceProfiles(
      JSON.stringify([
        {
          folderId: OPERATIONAL_FOLDER_ID,
          sourceProfile: "monthly_plan",
          authStrategy: "service_account",
          resourceKey: "resource-key-example",
        },
      ]),
    );

    expect(
      resolveAllowedDriveSource({
        folderId: ACADEMIC_FOLDER_ID,
        defaultAcademicFolderId: ACADEMIC_FOLDER_ID,
        configuredProfiles: [
          ...configuredProfiles,
          {
            folderId: ACADEMIC_FOLDER_ID,
            sourceProfile: "report",
            academicScope: null,
            authStrategy: "auto",
            resourceKey: null,
          },
        ],
      }),
    ).toMatchObject({
      sourceProfile: "academic",
      academicScope: "user",
    });
    expect(
      resolveAllowedDriveSource({
        folderId: OPERATIONAL_FOLDER_ID,
        requestedSourceProfile: "monthly_plan",
        defaultAcademicFolderId: ACADEMIC_FOLDER_ID,
        configuredProfiles,
      }),
    ).toMatchObject({ sourceProfile: "monthly_plan" });
    expect(configuredProfiles[0]).toMatchObject({
      authStrategy: "service_account",
      resourceKey: "resource-key-example",
    });
    expect(
      resolveAllowedDriveSource({
        folderId: OPERATIONAL_FOLDER_ID,
        requestedSourceProfile: "report",
        defaultAcademicFolderId: ACADEMIC_FOLDER_ID,
        configuredProfiles,
      }),
    ).toBeNull();
    expect(
      resolveAllowedDriveSource({
        folderId: "1NotConfiguredFolderIdentifier1234",
        defaultAcademicFolderId: ACADEMIC_FOLDER_ID,
        configuredProfiles,
      }),
    ).toBeNull();
  });

  test("bloqueia SSRF e redirecionamentos para fora da infraestrutura do Google", () => {
    expect(
      assertSafeGoogleDriveFetchUrl(
        "https://www.googleapis.com/drive/v3/files/example",
      ).hostname,
    ).toBe("www.googleapis.com");
    expect(
      resolveSafeGoogleDriveRedirect(
        "https://www.googleapis.com/drive/v3/files/example",
        "https://content.googleapis.com/download/example",
      ),
    ).toContain("content.googleapis.com");
    expect(() =>
      assertSafeGoogleDriveFetchUrl("http://127.0.0.1/internal"),
    ).toThrow(/não permitido/);
    expect(() =>
      resolveSafeGoogleDriveRedirect(
        "https://www.googleapis.com/drive/v3/files/example",
        "https://example.com/private",
      ),
    ).toThrow(/não permitido/);
  });
});
