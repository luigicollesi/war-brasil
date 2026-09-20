import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/src/components/legal/legal-document";
import styles from "@/src/components/legal/legal-document.module.css";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de privacidade do Bellum Civile.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Documento público // Dados pessoais"
      title="Política de Privacidade"
      lead="Esta Política explica quais dados o Bellum Civile utiliza, por que eles são necessários e como são tratados durante o uso do jogo."
      updatedAt="19 de setembro de 2026"
      sections={[
        {
          title: "Escopo",
          content: (
            <p>
              Esta Política se aplica à Home pública, autenticação, perfil de comandante, partidas, recursos sociais, loja de cosméticos e demais funcionalidades do Bellum Civile.
            </p>
          ),
        },
        {
          title: "Dados coletados",
          content: (
            <ul>
              <li>Dados de autenticação, como email, identificadores de provedores e informações necessárias à sessão.</li>
              <li>Data de nascimento, utilizada de forma privada para verificar o requisito de idade.</li>
              <li>Nome de exibição, identificador @, bio, título e aparência escolhidos para o perfil.</li>
              <li>Dados de partidas, salas, resultados, inventário, cosméticos, amizades, convites e preferências.</li>
              <li>Dados técnicos necessários para segurança, prevenção de abuso, estabilidade e funcionamento do serviço.</li>
            </ul>
          ),
        },
        {
          title: "Data de nascimento e idade",
          content: (
            <>
              <p>
                A data de nascimento não é exibida no perfil público. Ela é armazenada para que a idade possa ser calculada corretamente ao longo do tempo, sem manter um número de idade que ficaria desatualizado.
              </p>
              <p>
                Se a data informada indicar idade inferior a 10 anos, a conta não poderá prosseguir e será excluída do sistema ativo. Informações históricas de partidas que precisem permanecer para integridade do jogo podem ser desvinculadas da identidade da conta.
              </p>
            </>
          ),
        },
        {
          title: "Finalidades",
          content: (
            <ul>
              <li>Autenticar usuários e proteger contas e sessões.</li>
              <li>Verificar elegibilidade de idade e aplicar regras do serviço.</li>
              <li>Operar perfis, partidas, matchmaking, recursos sociais e cosméticos.</li>
              <li>Prevenir fraude, abuso, acessos indevidos e incidentes de segurança.</li>
              <li>Cumprir obrigações legais e exercer direitos quando necessário.</li>
            </ul>
          ),
        },
        {
          title: "Perfil público",
          content: (
            <p>
              Nome de exibição, identificador @, presença, títulos, cosméticos equipados e informações de jogo configuradas como públicas podem ser vistos por outros jogadores. Email, senha, tokens de sessão e data de nascimento não são exibidos no perfil público.
            </p>
          ),
        },
        {
          title: "Crianças e adolescentes",
          content: (
            <>
              <p>
                O serviço aplica idade mínima de 10 anos. O tratamento de dados de crianças e adolescentes deve observar seu melhor interesse e as exigências específicas da legislação aplicável.
              </p>
              <p>
                Quando for legalmente necessário consentimento específico de pai, mãe ou responsável legal, esse requisito deve ser atendido antes do tratamento que dependa desse consentimento.
              </p>
            </>
          ),
        },
        {
          title: "Prestadores de serviço",
          content: (
            <p>
              O Bellum Civile pode utilizar prestadores especializados para hospedagem, banco de dados, armazenamento de assets, autenticação, entrega de email, monitoramento e segurança. Esses prestadores recebem apenas os dados necessários à execução de suas funções e estão sujeitos às condições aplicáveis de proteção de dados.
            </p>
          ),
        },
        {
          title: "Segurança e retenção",
          content: (
            <p>
              São adotadas medidas técnicas e organizacionais compatíveis com a natureza do serviço para reduzir riscos de acesso indevido, perda e alteração não autorizada. Os dados são mantidos pelo período necessário às finalidades descritas, à segurança, à integridade das partidas e às obrigações legais aplicáveis.
            </p>
          ),
        },
        {
          title: "Direitos do titular",
          content: (
            <p>
              O usuário pode solicitar informações, correção e demais direitos previstos na legislação aplicável. Funcionalidades de conta e canais disponibilizados pelo serviço poderão ser utilizados para essas solicitações. Consulte também os{" "}
              <Link href="/terms" className={styles.inlineLink}>
                Termos de Uso
              </Link>.
            </p>
          ),
        },
        {
          title: "Atualizações",
          content: (
            <p>
              Esta Política pode ser atualizada quando houver mudanças relevantes no tratamento de dados, no produto ou na legislação. A versão vigente e sua data de atualização permanecerão disponíveis publicamente nesta página.
            </p>
          ),
        },
      ]}
    />
  );
}
