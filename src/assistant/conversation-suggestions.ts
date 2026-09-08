export type ConversationSuggestion = { label: string; prompt: string };

/** Local starters: no provider call and no claim that a pending issue exists. */
export function getConversationSuggestions(screen = "", lesson = false): ConversationSuggestion[] {
  if (lesson) return [
    { label: "Preparar a aula", prompt: "Me ajude a preparar a aula desta turma para a data selecionada, considerando o planejamento disponível." },
    { label: "Adaptar atividades", prompt: "Quais adaptações você sugere para as atividades desta turma, com base nos registros disponíveis?" },
    { label: "Revisar a evolução", prompt: "Resuma a evolução desta turma com base nos registros disponíveis e indique o que ainda precisamos observar." },
  ];
  const context = screen.toLowerCase();
  if (/finance|finan/.test(context)) return [
    { label: "Resumir o financeiro", prompt: "Resuma a situação financeira usando apenas os dados disponíveis neste contexto." },
    { label: "Revisar pendências", prompt: "Quais pendências financeiras aparecem nos dados disponíveis? Indique o que precisa ser conferido, sem presumir valores." },
    { label: "Organizar próximos passos", prompt: "Me ajude a organizar os próximos passos da revisão financeira, com base no contexto disponível." },
  ];
  if (/classes|turmas/.test(context)) return [
    { label: "Resumir as turmas", prompt: "Faça um resumo das turmas com base nos dados disponíveis nesta tela." },
    { label: "Revisar pendências", prompt: "Há pendências das turmas nos dados disponíveis? Liste apenas o que puder confirmar e sugira próximos passos." },
    { label: "Organizar a semana", prompt: "Me ajude a organizar a semana das turmas. Use os dados disponíveis e pergunte o que faltar." },
  ];
  if (/students|alunos|atletas/.test(context)) return [
    { label: "Revisar cadastros", prompt: "Quais informações de cadastro precisam de revisão, considerando apenas os dados disponíveis?" },
    { label: "Acompanhar presença", prompt: "Me ajude a revisar a presença dos alunos com base nos registros disponíveis." },
    { label: "Planejar acompanhamento", prompt: "Me ajude a organizar o acompanhamento dos alunos. Pergunte o que faltar para definir próximos passos." },
  ];
  return [
    { label: "Resumir o contexto", prompt: "Resuma o contexto desta tela com base nos dados disponíveis." },
    { label: "Revisar pendências", prompt: "Quais pendências você consegue confirmar no contexto disponível?" },
    { label: "Planejar próximos passos", prompt: "Me ajude a definir os próximos passos com base neste contexto. Pergunte o que faltar." },
  ];
}
