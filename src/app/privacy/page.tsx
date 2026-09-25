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
      eyebrow="Dados pessoais // Bellum Civile"
      title="Política de Privacidade"
      lead="Esta Política explica, em linguagem direta, quais dados podem ser tratados pelo Bellum Civile, para que eles são usados, quando podem ser compartilhados e quais escolhas o jogador possui."
      updatedAt="20 de setembro de 2026"
      highlights={[
        {
          label: "Idade",
          value: "A data de nascimento é privada e usada para verificar elegibilidade.",
        },
        {
          label: "Perfil",
          value: "Somente informações de perfil configuradas como públicas aparecem para outros jogadores.",
        },
        {
          label: "Controle",
          value: "Você pode exercer os direitos previstos pela legislação de proteção de dados aplicável.",
        },
      ]}
      sections={[
        {
          title: "Sobre esta Política",
          summary: "Ela cobre as áreas públicas e autenticadas do Bellum Civile.",
          content: (
            <>
              <p>
                Esta Política se aplica à Home pública, autenticação, perfil de
                comandante, matchmaking, salas, partidas, recursos sociais,
                inventário, loja de cosméticos e demais funcionalidades operadas pelo
                Bellum Civile.
              </p>
              <p>
                Serviços de terceiros utilizados para login, infraestrutura ou outras
                funções podem manter políticas próprias para atividades realizadas
                diretamente por eles.
              </p>
            </>
          ),
        },
        {
          title: "Quais dados tratamos?",
          summary: "Os dados variam conforme os recursos que você realmente utiliza.",
          content: (
            <ul>
              <li>
                <strong>Conta e autenticação:</strong> e-mail, identificadores de
                provedores de login, informações de sessão e registros necessários à
                segurança da conta.
              </li>
              <li>
                <strong>Elegibilidade de idade:</strong> data de nascimento e registro
                de quando a verificação de idade foi concluída.
              </li>
              <li>
                <strong>Perfil:</strong> nome de exibição, identificador @, bio,
                títulos, backgrounds, cosméticos equipados, presença e preferências
                relacionadas ao perfil.
              </li>
              <li>
                <strong>Jogo e recursos sociais:</strong> salas, partidas, resultados,
                ações de jogo, inventário, convites, amizades, bloqueios e demais
                interações necessárias ao funcionamento dos recursos utilizados.
              </li>
              <li>
                <strong>Dados técnicos e de segurança:</strong> informações
                necessárias para autenticação, prevenção de abuso, diagnóstico de
                falhas, estabilidade e proteção da infraestrutura.
              </li>
            </ul>
          ),
        },
        {
          title: "De onde vêm os dados?",
          summary: "A maior parte vem de você, da sua atividade no jogo ou de provedores usados para autenticação.",
          content: (
            <>
              <p>
                Recebemos dados diretamente quando você cria uma conta, informa sua
                data de nascimento, define um perfil ou interage com recursos do jogo.
              </p>
              <p>
                Também geramos informações durante partidas e outras operações do
                serviço. Quando você entra com um provedor externo, podemos receber os
                identificadores e dados que esse provedor disponibiliza para concluir
                a autenticação, de acordo com as permissões aplicáveis.
              </p>
            </>
          ),
        },
        {
          title: "Por que usamos esses dados?",
          summary: "Tratamos dados para operar o jogo, proteger contas, aplicar regras e cumprir obrigações legais.",
          content: (
            <ul>
              <li>Criar, autenticar e proteger contas e sessões.</li>
              <li>Verificar o requisito de idade e aplicar as regras do serviço.</li>
              <li>Operar perfis, matchmaking, salas, partidas e recursos sociais.</li>
              <li>Registrar inventário, cosméticos, créditos e estados necessários à economia do jogo.</li>
              <li>Detectar fraude, abuso, acesso indevido e incidentes de segurança.</li>
              <li>Diagnosticar erros, manter disponibilidade e melhorar a estabilidade do serviço.</li>
              <li>Cumprir obrigações legais e exercer ou defender direitos quando necessário.</li>
            </ul>
          ),
        },
        {
          title: "Bases legais",
          summary: "A base utilizada depende da finalidade e da legislação aplicável.",
          content: (
            <>
              <p>
                Conforme a situação, o tratamento pode se apoiar na execução do
                serviço solicitado pelo usuário, cumprimento de obrigação legal,
                exercício regular de direitos, proteção contra fraude e segurança,
                interesses legítimos compatíveis com os direitos do titular ou
                consentimento, quando ele for exigido.
              </p>
              <p>
                Quando uma atividade depender de consentimento, o usuário deve receber
                as informações necessárias antes da coleta e poderá exercer os direitos
                previstos pela legislação aplicável.
              </p>
            </>
          ),
        },
        {
          title: "Data de nascimento e idade",
          summary: "A data é armazenada como dado privado; o perfil público não mostra sua idade.",
          content: (
            <>
              <p>
                Armazenamos a data de nascimento em área privada para que a idade possa
                ser derivada corretamente ao longo do tempo. Isso evita manter um número
                de idade estático que ficaria desatualizado.
              </p>
              <p>
                Se a data informada indicar idade inferior a 10 anos, a conta não
                poderá continuar e será excluída do sistema ativo. Registros históricos
                de partidas que precisem ser mantidos por integridade do jogo, segurança
                ou obrigação legal podem ser preservados sem permanecer vinculados à
                conta ativa sempre que tecnicamente e juridicamente adequado.
              </p>
            </>
          ),
        },
        {
          title: "Crianças e adolescentes",
          summary: "A idade mínima do jogo não elimina proteções adicionais exigidas por lei.",
          content: (
            <>
              <p>
                O Bellum Civile estabelece idade mínima de 10 anos. O tratamento de
                dados de crianças e adolescentes deve observar seu melhor interesse e
                as regras específicas aplicáveis a esse público.
              </p>
              <p>
                Quando a legislação exigir consentimento específico de pai, mãe ou
                responsável legal, esse consentimento deverá ser obtido antes da
                atividade de tratamento que dependa dele. A verificação técnica de
                idade não substitui uma autorização legalmente necessária.
              </p>
            </>
          ),
        },
        {
          title: "O que fica público?",
          summary: "A identidade do comandante pode ser pública; credenciais e data de nascimento não.",
          content: (
            <>
              <p>
                Nome de exibição, identificador @, bio, presença, títulos, backgrounds,
                cosméticos equipados e outras informações de jogo configuradas como
                públicas podem ser vistas por outros jogadores.
              </p>
              <p>
                E-mail, senha, tokens de sessão, credenciais de autenticação e data de
                nascimento não fazem parte do perfil público.
              </p>
            </>
          ),
        },
        {
          title: "Compartilhamento e prestadores",
          summary: "Usamos provedores de infraestrutura e operação somente quando necessários para prestar o serviço.",
          content: (
            <>
              <p>
                Podemos utilizar prestadores especializados para hospedagem, banco de
                dados, armazenamento de assets, autenticação, entrega de e-mail,
                monitoramento, segurança e outras funções técnicas necessárias.
              </p>
              <p>
                Esses prestadores podem processar dados na medida necessária para
                executar a função contratada. Também poderemos fornecer informações
                quando houver obrigação legal, ordem válida de autoridade competente ou
                necessidade de proteger direitos, usuários ou a segurança do serviço.
              </p>
            </>
          ),
        },
        {
          title: "Transferências internacionais",
          summary: "Alguns provedores podem processar dados fora do Brasil.",
          content: (
            <p>
              Como serviços de infraestrutura podem operar em diferentes países, dados
              pessoais podem ser processados fora do Brasil. Quando aplicável,
              adotaremos os mecanismos e salvaguardas exigidos pela legislação para
              transferências internacionais de dados.
            </p>
          ),
        },
        {
          title: "Retenção e exclusão",
          summary: "Mantemos dados pelo tempo necessário à finalidade, segurança e obrigações aplicáveis.",
          content: (
            <>
              <p>
                Os períodos de retenção variam conforme o tipo de dado, a necessidade
                operacional, a segurança, o histórico das partidas e eventuais
                obrigações legais.
              </p>
              <p>
                Quando a finalidade termina, os dados podem ser eliminados,
                anonimizados ou mantidos apenas pelo período e nas hipóteses permitidas
                por lei. A exclusão de uma conta não significa necessariamente remoção
                imediata de todo registro técnico ou histórico que possua fundamento
                legítimo para retenção.
              </p>
            </>
          ),
        },
        {
          title: "Segurança",
          summary: "Aplicamos controles técnicos e operacionais para reduzir riscos de acesso indevido.",
          content: (
            <p>
              Utilizamos medidas compatíveis com a natureza do serviço para proteger
              contas e dados contra acesso não autorizado, alteração, perda e uso
              indevido. Nenhum sistema online é completamente imune a incidentes, por
              isso os controles são revisados e aprimorados conforme o serviço evolui.
            </p>
          ),
        },
        {
          title: "Seus direitos",
          summary: "A legislação pode garantir acesso, correção, eliminação e outras formas de controle sobre seus dados.",
          content: (
            <>
              <p>
                Quando a LGPD for aplicável, você poderá exercer direitos como
                confirmação da existência de tratamento, acesso, correção, informação
                sobre compartilhamento, anonimização, bloqueio ou eliminação nos casos
                previstos em lei, portabilidade quando regulamentada e cabível,
                revogação de consentimento e revisão de situações previstas pela
                legislação.
              </p>
              <p>
                Algumas solicitações podem exigir verificação de identidade e certos
                dados podem precisar ser preservados quando houver obrigação ou outra
                base legal para retenção. Consulte também os{" "}
                <Link href="/terms" className={styles.inlineLink}>
                  Termos de Uso
                </Link>.
              </p>
            </>
          ),
        },
        {
          title: "Cookies e armazenamento local",
          summary: "Tecnologias locais podem ser usadas para sessão, segurança e funcionamento da interface.",
          content: (
            <p>
              O serviço pode utilizar cookies, armazenamento local e tecnologias
              semelhantes estritamente relacionadas à autenticação, manutenção de
              sessão, preferências de interface, segurança e funcionamento técnico.
              Caso novas finalidades sejam adicionadas, esta Política poderá ser
              atualizada para refletir essas mudanças.
            </p>
          ),
        },
        {
          title: "Alterações desta Política",
          summary: "A versão pública mais recente permanecerá disponível nesta página.",
          content: (
            <p>
              Esta Política pode ser atualizada para refletir mudanças no produto, na
              infraestrutura, nas práticas de tratamento ou na legislação. Alterações
              relevantes poderão ser comunicadas dentro do serviço quando apropriado.
              A data da versão vigente permanece indicada no início deste documento.
            </p>
          ),
        },
      ]}
    />
  );
}
