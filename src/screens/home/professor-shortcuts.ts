export const professorShortcuts = [
  { label: "Turmas", description: "Cadastros e lista", icon: "classes", route: "/prof/classes", gate: "canOpenClassesShortcut", keywords: "aula chamada presença" },
  { label: "Alunos", description: "Lista e chamada", icon: "students", route: "/prof/students", gate: "canOpenStudentsShortcut", keywords: "atletas matrículas" },
  { label: "Planejamento", description: "Modelos e planejamentos", icon: "planning", route: "/prof/planning", gate: "canOpenTrainingShortcut", keywords: "montar plano treino" },
  { label: "Agenda", description: "Aulas e chamada", icon: "calendar", route: "/prof/calendar", gate: "canOpenCalendarShortcut" },
  { label: "Presença NFC", description: "Registrar por UID", icon: "nfc", route: "/prof/nfc-attendance", gate: "canOpenClassesShortcut" },
  { label: "Notificações", description: "Atualizações e ausências", icon: "absenceNotices", route: "/prof/absence-notices", gate: "canOpenAbsenceNoticesShortcut" },
  { label: "Exercícios", description: "Biblioteca com vídeos", icon: "exercises", route: "/prof/exercises", gate: "canOpenTrainingShortcut", keywords: "biblioteca atividades" },
  { label: "Periodização", description: "Ciclos e cargas", icon: "periodization", route: "/prof/periodization", gate: "canOpenPeriodizationShortcut" },
  { label: "Consultoria online", description: "Prescrição individual", icon: "consultation", route: "/prof/consultation", gate: "canOpenStudentsShortcut" },
  { label: "Assistente IA", description: "Apoio ao professor", icon: "assistant", route: "/prof/assistant", gate: "canOpenAssistantShortcut" },
  { label: "Regulamentos", description: "Fontes e histórico", icon: "regulations", route: "/prof/regulation-history", gate: "canOpenRegulationHistoryShortcut" },
] as const;
