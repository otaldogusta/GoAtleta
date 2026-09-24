import { LegalDocumentScreen } from "../src/components/legal/LegalDocumentScreen";

export default function DataDeletionScreen() {
  return (
    <LegalDocumentScreen
      title="Exclusão de Dados"
      summary="Você pode pedir a exclusão da conta e dos dados pessoais associados ao Go Atleta."
      sections={[
        {
          title: "Como solicitar",
          paragraphs: [
            "Envie um e-mail para gusantinho753@gmail.com com o assunto “Exclusão de dados Go Atleta”, usando o endereço associado à conta. Informe apenas o nome e o e-mail da conta; nunca envie senha ou código de verificação.",
          ],
        },
        {
          title: "Confirmação e prazo",
          paragraphs: [
            "Podemos solicitar uma confirmação segura de identidade antes de executar o pedido. Após a validação, informaremos o andamento e concluiremos a solicitação no prazo legal aplicável.",
          ],
        },
        {
          title: "O que será removido",
          paragraphs: [
            "A conta, os vínculos ativos e os dados pessoais sob responsabilidade direta do Go Atleta serão eliminados ou anonimizados, salvo quando houver obrigação legal, prevenção a fraude, exercício de direitos ou outra base legal para retenção limitada.",
          ],
        },
        {
          title: "Dados administrados por uma organização",
          paragraphs: [
            "Registros esportivos inseridos por uma instituição também podem estar sujeitos às obrigações dessa organização. O Go Atleta encaminhará ou coordenará a solicitação quando necessário.",
          ],
        },
      ]}
    />
  );
}
