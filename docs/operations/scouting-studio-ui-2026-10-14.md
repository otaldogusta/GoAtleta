# Estúdio de scouting — refinamento local de 14/10/2026

## Composição e comportamento

Cabeçalho e transporte compactos; Adicionar vídeo usa o símbolo de adição. Um campo reconhece YouTube ou Drive. Confirmação da mesma edição permanece obrigatória; sincronização, nova análise e credenciais ficam em opções recolhidas. Erros de link desaparecem ao editar.

Rallies usa lista alinhada com miniaturas e tempos. Quadros reais são extraídos do original associado em streaming; somente YouTube usa uma prévia do vídeo identificada como tal. Contatos reúne lista e editor: clicar na timeline abre o contato, e Salvar só habilita após uma mudança efetiva. Informações contém fonte, trajetória e ferramentas técnicas. Timeline sem reserva lateral arbitrária, com grupos compactos e escala preservada.

Layout de duas colunas no desktop e empilhado em telas menores; temas claro/escuro usam os tokens existentes. Campos preservam o padrão global. Rodapé do painel acompanha seu conteúdo no celular, sem sobrepor a lista.

## Evidências locais

- Seis suítes focadas: 62 testes aprovados; tipos, lint focado, escopo organizacional e higiene de performance strict aprovados.
- Conferência visual em 390 × 844, 834 × 1194 e 1440 × 1024, nos dois temas, sem overflow horizontal dos painéis.
- Fluxos reais: reconhecimento/erro de link, reassociação do Drive sem recalcular, miniaturas distintas, editor contextual, alteração/reversão e Salvar desabilitado sem mudança.
- Exportação integral antes/depois semanticamente idêntica: 78 rallies, 201 contatos, 17.508 posições e nenhuma correção manual adicionada. SHA-256 da exportação final: `273353826c8461fcb89f09f768284e827ddf8e31997d2b1fc92f6370060f66f4`.
- Capturas e exportações ficam em `.tmp/scouting-studio-clean`, ignorado pelo Git. Nenhum MP4 salvo, nova inferência, alteração de esquema, autorização ou persistência.

Entrega exclusivamente local; sem commit, push, deploy, migration remota ou ativação de serviço.
