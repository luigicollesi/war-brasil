import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/src/components/legal/legal-document";
import styles from "@/src/components/legal/legal-document.module.css";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de uso do Bellum Civile.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Documento público // Uso do serviço"
      title="Termos de Uso"
      lead="Estes Termos regulam o acesso ao Bellum Civile, incluindo conta, partidas, recursos sociais e cosméticos."
      updatedAt="19 de setembro de 2026"
      sections={[
        {
          title: "Aceitação",
          content: (
            <>
              <p>
                Ao criar uma conta ou utilizar o Bellum Civile, você declara que leu e aceita estes Termos e a{" "}
                <Link href="/privacy" className={styles.inlineLink}>
                  Política de Privacidade
                </Link>.
              </p>
              <p>
                Se você não concordar com estas condições, não deve criar uma conta nem utilizar as áreas autenticadas do jogo.
              </p>
            </>
          ),
        },
        {
          title: "Idade mínima",
          content: (
            <>
              <p>
                O Bellum Civile é destinado a jogadores com 10 anos de idade ou mais. Antes de concluir a identidade pública do comandante, o serviço solicita a data de nascimento para verificar esse requisito.
              </p>
              <p>
                Contas que informarem idade inferior a 10 anos não poderão continuar e serão excluídas. Usuários devem fornecer uma data de nascimento verdadeira. Informações deliberadamente falsas sobre idade constituem violação destes Termos e podem resultar no encerramento da conta.
              </p>
              <p>
                Na medida permitida pela legislação aplicável, o Bellum Civile não responde por consequências decorrentes de declaração deliberadamente falsa de idade feita pelo usuário. Esta previsão não afasta obrigações legais que não possam ser excluídas por contrato.
              </p>
              <p>
                Quando a legislação exigir participação ou consentimento de responsável legal para o tratamento de dados de crianças ou adolescentes, o uso do serviço também estará sujeito a essas exigências.
              </p>
            </>
          ),
        },
        {
          title: "Conta e identidade",
          content: (
            <>
              <p>
                Você é responsável por manter suas credenciais protegidas e por fornecer informações corretas durante cadastro, autenticação e configuração do comandante.
              </p>
              <p>
                Nome de exibição e identificador @ podem ser visíveis a outros jogadores. Email, credenciais e data de nascimento não fazem parte do perfil público.
              </p>
            </>
          ),
        },
        {
          title: "Conduta",
          content: (
            <ul>
              <li>Não utilize o serviço para assediar, ameaçar ou prejudicar outros jogadores.</li>
              <li>Não tente acessar contas, salas, sistemas ou dados sem autorização.</li>
              <li>Não explore falhas, automações ou mecanismos destinados a obter vantagem indevida.</li>
              <li>Não use nomes, mensagens ou conteúdos que violem direitos de terceiros ou a legislação aplicável.</li>
            </ul>
          ),
        },
        {
          title: "Partidas e disponibilidade",
          content: (
            <>
              <p>
                O jogo pode receber ajustes de regras, balanceamento, interface, infraestrutura e disponibilidade. Partidas podem ser interrompidas por manutenção, falhas técnicas, segurança ou atualização do serviço.
              </p>
              <p>
                Não há garantia de disponibilidade ininterrupta, preservação de partidas em andamento ou manutenção permanente de uma funcionalidade específica.
              </p>
            </>
          ),
        },
        {
          title: "Economia e cosméticos",
          content: (
            <p>
              Itens cosméticos, moedas virtuais e recursos semelhantes não representam propriedade sobre ativos reais e não alteram, por si só, as regras fundamentais da partida. Catálogo, disponibilidade, aparência e condições de aquisição podem ser atualizados pelo serviço.
            </p>
          ),
        },
        {
          title: "Propriedade intelectual",
          content: (
            <p>
              Interface, código, identidade visual, textos, ilustrações, modelos, sons e demais elementos próprios do Bellum Civile são protegidos pela legislação aplicável. O uso do serviço não transfere direitos de propriedade intelectual ao usuário.
            </p>
          ),
        },
        {
          title: "Suspensão e encerramento",
          content: (
            <p>
              Contas podem ser suspensas ou encerradas quando houver violação destes Termos, risco à segurança, fraude, informação materialmente falsa ou necessidade de cumprimento legal. A aplicação buscará preservar registros que devam ser mantidos por obrigação legal ou integridade histórica das partidas.
            </p>
          ),
        },
        {
          title: "Alterações",
          content: (
            <p>
              Estes Termos podem ser atualizados para refletir mudanças no jogo, na infraestrutura ou em requisitos legais. A versão vigente e sua data de atualização permanecerão disponíveis publicamente nesta página.
            </p>
          ),
        },
      ]}
    />
  );
}
