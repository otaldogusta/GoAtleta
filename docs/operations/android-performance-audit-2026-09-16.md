# Auditoria de performance Android — 16/09/2026

## Escopo e limite da conclusão

Inspeção do código, testes e amostragem via ADB no Samsung Galaxy S25 (SM-S931B), pacote `com.otaldogusta.goatleta.dev`, versão `1.0.2-dev`, versionCode 3, DEBUGGABLE. Hermes e New Architecture habilitados. Pacote de produção não foi alterado; nenhum dado foi apagado e não houve publicação.

Esta é uma auditoria inicial de desenvolvimento, não uma certificação de performance do APK de produção. Não houve perfil de CPU JavaScript, heap snapshot, medição de rede por operação ou benchmark de release. O aparelho de alto desempenho e a lista pequena não representam aparelhos de entrada ou grandes instituições.

## Evidências medidas

| Contexto | Resultado | Interpretação |
| --- | --- | --- |
| Sessão antiga, com histórico de desenvolvimento | PSS 1.081.753 KB; 3.819/16.261 quadros janky (23,49%) | Histórico cumulativo, sem controle de carga; não serve como baseline comparável |
| Reinício frio da Activity | TotalTime 788 ms; WaitTime 791 ms | Mede lançamento Android, não conteúdo pronto ou tempo até interação |
| Splash após reinício | PSS 215.924 KB | Não comparar com Home carregada |
| Home carregada, quatro ciclos de rolagem, aproximadamente 5,3 s | 18/304 quadros janky (5,92%); frame p50 9 ms, p95 12 ms, p99 14 ms; GPU p95 4 ms | Amostra curta; ainda há quadros fora do prazo |
| Memória após essa amostra | PSS 977.512 KB (~955 MiB); RSS 1.103.964 KB; native PSS 647.978 KB | Consumo elevado no desenvolvimento; não comprova vazamento |
| APK debug existente | 129.694.597 bytes (~123,7 MiB) | Não representa tamanho de download do release/AAB |
| Computador com Metro | ~846 MiB RAM livre de ~15,5 GiB; Metro RSS ~1,16 GiB | Possível pressão no ambiente de desenvolvimento; causalidade não medida |

Houve demora superior a aproximadamente um minuto no carregamento inicial via Metro. Não foi instrumentado um tempo preciso até conteúdo pronto. As amostras diferentes não permitem calcular ganho percentual das alterações.

## Correções locais realizadas

1. **Atualizações globais em cada movimento do pull-to-refresh:** o feedback visual possui estados discretos, mas substituía o estado do provider a cada distância recebida. `refresh-feedback-state.ts` agora preserva a referência quando o estado visual não muda. A distância real permanece no controle; limiar, atualização de dados e proteção de edições não foram alterados. Teste cobre 111 valores consecutivos sem substituição de estado.
2. **Logs a cada render de desenvolvimento:** `useRenderDiagnostic.ts` estava habilitado globalmente. Foi desligado por padrão. Essa correção reduz trabalho no desenvolvimento, não representa ganho em release, onde o diagnóstico já era desativado.
3. **Relógio da Home fora de foco:** `HomeProfessor.tsx` mantinha atualização periódica mesmo com outra aba selecionada. O intervalo agora acompanha foco e AppState, é removido ao sair e atualiza o horário ao retornar ao primeiro plano.

Arquivos envolvidos: `src/ui/RefreshFeedbackProvider.tsx`, `src/ui/refresh-feedback-state.ts`, `src/ui/__tests__/refresh-feedback-state.test.ts`, `src/dev/useRenderDiagnostic.ts` e `src/screens/home/HomeProfessor.tsx`. Alterações anteriores do working tree foram preservadas.

## Achados pendentes, por prioridade

### Alta: memória e fluidez em release

PSS próximo de 955 MiB merece perfil. O dev client, ferramentas de depuração e histórico de recarregamentos afetam a interpretação. Para confirmar retenção: medir uma versão release isolada após estabilização e repetir ciclos Home → Turmas → Planejamento → retorno; comparar heap antes/depois e identificar objetos retidos. Não foi confirmado vazamento nesta sessão.

### Média: carga de fotos e metadados de Turmas

O carregamento de URLs de fotos usa Promise.all para os candidatos de todas as turmas, sem limite explícito de concorrência; até quatro candidatos por turma. Em bases grandes pode gerar rajadas. Há também uma etapa sequencial de coberturas de aulas após outras consultas de metadados. São candidatos a medição de rede e eventual limitação/paralelização, não gargalos comprovados. Não mudar assinatura de fotos privadas, isolamento de organização ou autorização para otimizar.

### Média: configuração e tamanho do release

O Gradle local deixa minificação e remoção de recursos desativadas por padrão e associa o buildType release à assinatura debug. Isso não prova como o artefato distribuído foi assinado/configurado. Antes de publicar, verificar o pipeline efetivo e validar um artefato release isolado. Não ativar minificação indiscriminadamente: exige smoke dos módulos nativos e regras de preservação.

### Ambiente: Metro e pressão de RAM

O computador estava com pouca memória livre durante a análise. Isso pode prejudicar bundling e desenvolvimento. Nenhum processo externo foi encerrado. Medir novamente com recursos disponíveis antes de atribuir a espera de Metro ao runtime do app.

## Pontos já adequados na implementação

- Lista principal de Turmas usa FlatList e componente memoizado, não uma renderização integral por map.
- Shimmer compartilha animação entre consumidores, usa driver nativo no Android e libera consumidores no cleanup.
- Metro exclui diretórios gerados/logs do monitoramento.
- Não foram aplicadas otimizações especulativas como clipping da lista, que poderia esconder elementos flutuantes.

## Validação desta rodada

- Jest: `refresh-feedback-state.test.ts` e `AppRefreshControl.test.ts`: **2 suítes, 10 testes aprovados**.
- `npm run typecheck:app`: aprovado.
- `npm run check:release-perf`: aprovado, 14 telas no modo strict. É verificação estática, não benchmark.
- `npm run check:org-scope`: aprovado.
- `git diff --check`: aprovado (avisos de normalização CRLF em arquivos existentes).
- Amostragem ADB de Home/rolagem realizada; não equivale a E2E completo de refresh ou todas as telas.
- Não houve rebuild do APK nesta rodada; mudanças JavaScript locais são servidas pelo Metro. Nenhuma release foi instalada/publicada.

## Próximos gates para fechar a avaliação

1. Gerar e testar release isolado, sem sobrescrever o app de produção nem apagar dados.
2. Medir startup até conteúdo/interação, CPU JS/UI, memória estabilizada, GC, imagens e chamadas de rede.
3. Repetir cenários padronizados em aparelho intermediário/entrada, com massa fictícia maior e rede lenta/offline.
4. Exercitar refresh, navegação, teclado, formulários com alterações e retorno do background, verificando regressões e consumo após ciclos repetidos.
5. Comparar antes/depois com o mesmo artefato, aparelho, dados e roteiro; só então declarar melhoria quantitativa.

Referências: [React Native — debugging e limitações de desenvolvimento](https://reactnative.dev/docs/debugging); [Android — dumpsys, gfxinfo e meminfo](https://developer.android.com/tools/dumpsys).

## Continuação: artefato isolado gerado e instalado

- Criada variante opt-in `perf` via `scripts/validation/android-perf.init.gradle`, com instruções em `scripts/validation/android-perf/README.md`.
- Build concluído com sucesso: 1.150 tarefas, 1.085 executadas. A primeira tentativa falhou por SDK não localizado; o caminho foi fornecido somente no processo seguinte.
- Artefato: `android/app/build/outputs/apk/perf/app-perf.apk`, 99.537.432 bytes (~94,9 MiB), apenas arm64-v8a. A redução frente ao debug não é medida de otimização: arquitetura e modo de build diferem.
- Verificado no APK: `com.otaldogusta.goatleta.perf`, `1.0.2-perf`, assinatura válida, ausência de flag DEBUGGABLE, profileable por shell, OTA desativado e bundle embarcado de 14.700.500 bytes.
- Instalação ADB no usuário 0: `Success`. Início da Activity: `Status: ok`. Pacotes de desenvolvimento e produção preservados.
- O aparelho estava em Dozing durante o primeiro lançamento. Essa abertura não é benchmark válido de startup. Login com conta fictícia e aparelho desbloqueado ainda pendentes; não foi feita medição autenticada de Home em release.
- O nome no launcher é **GoAtleta Perf**. O pacote separado não altera o backend configurado; usar dados fictícios. Não houve push, deploy ou publicação.

A variante segue o mecanismo de [build types/applicationIdSuffix do Android](https://developer.android.com/build/build-variants) e [profiling em release](https://developer.android.com/studio/profile/build-run-manually).

### Correção do retorno Google no Perf

O primeiro manifesto isolado removeu também o esquema usado pelo OAuth,
impedindo o Perf de aparecer no seletor de retorno. Adicionado `goatleta://`
ao alias do Perf, mantendo os links HTTPS fora da variante e sem alterar
configuração remota. O esquema é compartilhado: escolher **GoAtleta Perf →
Só uma vez**, nunca definir como padrão durante o teste.

Build incremental aprovado (38 tarefas executadas, 1.112 reaproveitadas),
assinatura verificada e atualização ADB `install -r` concluída com `Success`.
Consulta read-only `query-activities` para `goatleta://login` confirmou as três
opções, incluindo `com.otaldogusta.goatleta.perf/…PerfLauncher`.
Login Google completo ainda depende de nova tentativa do usuário; a sessão
OAuth anterior não deve ser reaproveitada. Referência conferida com a skill
Supabase: [retorno nativo por deep link](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

## Amostra autenticada no Perf

Login Google confirmado pelo usuário e Home autenticada observada por screenshot.
Conta fictícia sem instituição/aulas, exibindo onboarding de aluno. Nenhum campo
foi editado nem dado de negócio gravado pelo teste; apenas onboarding dispensado,
navegação, rolagem e reinício do pacote Perf.

- PSS inicial com onboarding: 297.017 KB (~290 MiB); depois 249.260 KB (~243 MiB).
- Reinício com tela desbloqueada: Activity COLD, TotalTime 455 ms / WaitTime 458 ms.
  Não é tempo até dados prontos. Sessão persistiu; Home observada após reinício.
- PSS após reinício: 219.542 KB (~214 MiB).
- Perfil aberto e quatro pares de swipes verticais: 264 quadros, 6 janky (2,27%),
  p50 7 ms, p95 9 ms, p99 38 ms; GPU p95 4 ms. PSS 242.840 KB (~237 MiB).
- Dez leituras durante cinco pares rápidos de toques Home/Perfil: 235.846 a
  239.600 KB (~230–234 MiB). Sem crescimento monotônico nessa janela curta.
  Não é prova de ausência de vazamento, nem confirmação visual individual de
  cada transição: o roteiro foi rápido, sem estabilização por tela.

Limitação descoberta: Agenda/Conquistas retornam à Home. A regra
`shouldRedirectPendingRole` permite Home/Perfil para pending, não essas rotas;
comportamento compatível com uma conta ainda sem vínculo. Não foi removida a
proteção de acesso para completar o benchmark. Turmas/Planejamento e cargas
maiores continuam pendentes de conta fictícia com acesso autorizado.

Os ~230–290 MiB deste cenário não podem ser comparados diretamente aos ~955 MiB
do debug: papéis, volume de dados, telas e histórico de execução são diferentes.
Não foi calculado percentual de melhoria. Nenhuma nova correção de runtime nesta
rodada; os números não justificam alteração especulativa.
