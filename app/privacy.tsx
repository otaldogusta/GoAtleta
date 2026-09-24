import { LegalDocumentScreen } from "../src/components/legal/LegalDocumentScreen";
import { markRender } from "../src/observability/perf";

// perf-check: ignore-measure -- static legal content performs no asynchronous loading.

export default function PrivacyPolicyScreen() {
  markRender("screen.privacy.render.root");
  return (
    <LegalDocumentScreen
      title="Política de Privacidade"
      summary="O Go Atleta trata dados de atletas, responsáveis e profissionais somente para operar a plataforma esportiva, proteger as contas e prestar os serviços solicitados."
      sections={[
        {
          title: "Responsável pelo tratamento",
          paragraphs: [
            "Go Atleta, operado por Gustavo Ribeiro dos Santos, CNPJ 64.773.775/0001-82. Contato de privacidade: uniquexperieence@gmail.com.",
          ],
        },
        {
          title: "Dados tratados",
          paragraphs: ["Tratamos apenas os dados necessários para cadastro, vínculo esportivo, comunicação, segurança e funcionamento do serviço."],
          bullets: [
            "Identificação e contato, como nome, e-mail, telefone e dados de responsável.",
            "Informações esportivas e operacionais, como turmas, presença, planejamento e evolução.",
            "Dados técnicos de segurança, como registros de acesso, dispositivo e eventos de auditoria.",
            "Dados de comunicação necessários para notificações e mensagens solicitadas pela organização.",
          ],
        },
        {
          title: "Finalidades e bases legais",
          paragraphs: [
            "Os dados são usados para executar o serviço contratado ou solicitado, cumprir obrigações legais, proteger contas e atender interesses legítimos compatíveis com a operação esportiva. Quando necessário, solicitamos consentimento específico.",
          ],
        },
        {
          title: "WhatsApp e fornecedores",
          paragraphs: [
            "Quando uma organização habilita comunicações pelo WhatsApp, o número e o conteúdo estritamente necessário podem ser enviados à Meta para entrega da mensagem. Também usamos fornecedores de infraestrutura, autenticação, hospedagem e monitoramento sob obrigações de segurança e finalidade.",
          ],
        },
        {
          title: "Compartilhamento e retenção",
          paragraphs: [
            "Não vendemos dados pessoais. O acesso é limitado à organização responsável, usuários autorizados e fornecedores indispensáveis. Mantemos os dados pelo tempo necessário à prestação do serviço, a obrigações legais e à proteção de direitos, eliminando ou anonimizando quando aplicável.",
          ],
        },
        {
          title: "Direitos do titular",
          paragraphs: [
            "O titular pode solicitar confirmação, acesso, correção, portabilidade, informação sobre compartilhamento, revisão, oposição ou eliminação, conforme a LGPD. Solicitações podem ser enviadas ao contato de privacidade acima.",
          ],
        },
      ]}
    />
  );
}
