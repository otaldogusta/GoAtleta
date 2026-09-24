import { LegalDocumentScreen } from "../src/components/legal/LegalDocumentScreen";
import { markRender } from "../src/observability/perf";

// perf-check: ignore-measure -- static legal content performs no asynchronous loading.

export default function TermsScreen() {
  markRender("screen.terms.render.root");
  return (
    <LegalDocumentScreen
      title="Termos de Uso"
      summary="Estes termos definem as condições para usar o Go Atleta como atleta, responsável, professor ou administrador de uma organização."
      sections={[
        {
          title: "Uso da plataforma",
          paragraphs: [
            "O usuário deve fornecer informações verdadeiras, proteger suas credenciais e usar somente os recursos e dados aos quais recebeu acesso. Contas e permissões são pessoais e não podem ser compartilhadas.",
          ],
        },
        {
          title: "Responsabilidade das organizações",
          paragraphs: [
            "Cada organização é responsável por seus cadastros, convites, decisões esportivas, comunicações e permissões internas. O Go Atleta fornece ferramentas de apoio e não substitui avaliação profissional, médica, jurídica ou contábil.",
          ],
        },
        {
          title: "Comunicações",
          paragraphs: [
            "Mensagens por e-mail, notificação ou WhatsApp devem ter finalidade legítima relacionada ao serviço e respeitar preferências, consentimentos e políticas do canal. O usuário não pode usar o Go Atleta para spam, fraude ou conteúdo ilegal.",
          ],
        },
        {
          title: "Disponibilidade e alterações",
          paragraphs: [
            "Podemos corrigir, atualizar ou interromper recursos para segurança, manutenção ou evolução do produto. Mudanças relevantes nestes termos serão comunicadas pelos canais disponíveis.",
          ],
        },
        {
          title: "Encerramento",
          paragraphs: [
            "O acesso pode ser suspenso em caso de violação, risco à segurança ou obrigação legal. O usuário pode solicitar exclusão conforme a página de Exclusão de Dados e a Política de Privacidade.",
          ],
        },
        {
          title: "Contato",
          paragraphs: [
            "Dúvidas sobre estes termos podem ser enviadas para gusantinho753@gmail.com. Responsável: Gustavo Ribeiro dos Santos, CNPJ 64.773.775/0001-82.",
          ],
        },
      ]}
    />
  );
}
