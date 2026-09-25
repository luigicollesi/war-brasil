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
      eyebrow="Regras do serviço // Bellum Civile"
      title="Termos de Uso"
      lead="Estas são as regras para criar uma conta, entrar em partidas e usar os recursos do Bellum Civile. O objetivo é explicar de forma direta o que o jogador pode esperar do serviço e o que esperamos de cada jogador."
      updatedAt="20 de setembro de 2026"
      highlights={[
        {
          label: "Idade mínima",
          value: "O jogo é destinado a pessoas com 10 anos ou mais.",
        },
        {
          label: "Conta",
          value: "Sua conta é pessoal e você é responsável pelas informações que fornece.",
        },
        {
          label: "Jogo justo",
          value: "Exploração de falhas, fraude, abuso e vantagem indevida podem levar à suspensão.",
        },
      ]}
      sections={[
        {
          title: "Antes de jogar",
          summary: "Ao usar o serviço, você concorda com estas regras e com a Política de Privacidade.",
          content: (
            <>
              <p>
                Ao criar uma conta, autenticar-se ou utilizar uma área do Bellum
                Civile que exija conta, você declara que leu e concorda com estes
                Termos e com a{" "}
                <Link href="/privacy" className={styles.inlineLink}>
                  Política de Privacidade
                </Link>.
              </p>
              <p>
                Se você não concordar com estas condições, não deve criar uma conta
                nem continuar usando as áreas autenticadas do serviço.
              </p>
            </>
          ),
        },
        {
          title: "Quem pode jogar?",
          summary: "Bellum Civile exige pelo menos 10 anos de idade e uma declaração de nascimento verdadeira.",
          content: (
            <>
              <p>
                O Bellum Civile é destinado a jogadores com <strong>10 anos ou mais</strong>.
                Antes de concluir a identidade pública do comandante, solicitamos a
                data de nascimento para verificar esse requisito.
              </p>
              <p>
                Se a data informada indicar idade inferior a 10 anos, a conta não
                poderá prosseguir e será excluída. A data de nascimento deve ser
                verdadeira e não deve ser alterada ou falsificada para contornar a
                regra de idade.
              </p>
              <p>
                Informar deliberadamente uma idade falsa constitui violação destes
                Termos e pode resultar no encerramento da conta. O Bellum Civile não
                tem como validar uma declaração deliberadamente falsificada e, na
                medida permitida pela legislação aplicável, não se responsabiliza por
                consequências causadas por essa falsidade. Isso não limita direitos do
                usuário nem obrigações legais que não possam ser afastadas por contrato.
              </p>
              <p>
                Se a legislação aplicável exigir participação, autorização ou
                consentimento de pai, mãe ou responsável legal, o jogador também deve
                cumprir esse requisito. O simples fato de o sistema permitir
                tecnicamente o acesso não substitui uma autorização exigida por lei.
              </p>
            </>
          ),
        },
        {
          title: "Sua conta",
          summary: "A conta é pessoal. Proteja as credenciais e mantenha os dados fornecidos corretos.",
          content: (
            <>
              <p>
                Você é responsável pelo uso da sua conta e por manter senha, sessão e
                demais credenciais protegidas. Não compartilhe acesso de forma que
                permita a outra pessoa agir como se fosse você.
              </p>
              <p>
                Nome de exibição e identificador @ fazem parte da identidade pública
                do comandante. E-mail, credenciais e data de nascimento não são
                exibidos no perfil público.
              </p>
              <p>
                Podemos solicitar correção de informações ou restringir uma conta
                quando existirem indícios razoáveis de fraude, comprometimento de
                segurança ou informação materialmente falsa.
              </p>
            </>
          ),
        },
        {
          title: "Licença de uso",
          summary: "Você recebe uma permissão pessoal para jogar; o serviço e seus assets continuam pertencendo aos respectivos titulares.",
          content: (
            <>
              <p>
                Enquanto estes Termos forem respeitados, você recebe uma licença
                limitada, pessoal, não exclusiva, revogável e não transferível para
                acessar e utilizar o Bellum Civile para entretenimento pessoal.
              </p>
              <p>
                Essa licença não autoriza copiar, vender, redistribuir, explorar
                comercialmente, desmontar ou tentar obter acesso não autorizado ao
                código, infraestrutura ou assets do serviço, salvo quando a legislação
                aplicável permitir expressamente.
              </p>
            </>
          ),
        },
        {
          title: "Jogo justo e conduta",
          summary: "Competição faz parte do jogo; abuso, fraude e manipulação do serviço não.",
          content: (
            <ul>
              <li>Não assedie, ameace ou persiga outros jogadores.</li>
              <li>Não tente acessar contas, salas, sistemas ou dados sem autorização.</li>
              <li>Não explore bugs, falhas, automações ou manipulações para obter vantagem indevida.</li>
              <li>Não tente interferir na disponibilidade, segurança ou funcionamento do serviço.</li>
              <li>Não utilize nomes, mensagens ou outros conteúdos que violem a lei ou direitos de terceiros.</li>
              <li>Não utilize a conta para fraude, venda não autorizada, engenharia social ou personificação enganosa.</li>
            </ul>
          ),
        },
        {
          title: "Conteúdo e recursos sociais",
          summary: "Elementos públicos do perfil e interações sociais devem respeitar outros jogadores e a lei.",
          content: (
            <>
              <p>
                O Bellum Civile pode permitir nome público, convites, amizades e
                outras interações entre jogadores. Você continua responsável pelo
                conteúdo que decidir fornecer nesses espaços.
              </p>
              <p>
                Conteúdo que viole estes Termos poderá ser ocultado, removido ou gerar
                restrições de uso quando isso for necessário para proteger o serviço,
                outros usuários ou cumprir obrigação legal.
              </p>
            </>
          ),
        },
        {
          title: "Partidas e mudanças no jogo",
          summary: "Regras, balanceamento, interfaces e funcionalidades podem evoluir ao longo do desenvolvimento.",
          content: (
            <>
              <p>
                O Bellum Civile é um serviço em evolução. Podemos ajustar regras,
                balanceamento, mapas, modos, matchmaking, interfaces, economia,
                cosméticos e outros elementos para corrigir problemas ou melhorar o
                jogo.
              </p>
              <p>
                Manutenções, falhas técnicas, atualizações ou incidentes de segurança
                podem interromper uma partida ou tornar temporariamente indisponível
                uma funcionalidade. Não garantimos operação ininterrupta nem a
                preservação permanente de uma funcionalidade específica.
              </p>
            </>
          ),
        },
        {
          title: "Créditos, itens e cosméticos",
          summary: "Itens virtuais existem dentro do jogo e não representam dinheiro, investimento ou propriedade sobre ativos reais.",
          content: (
            <>
              <p>
                Créditos, cosméticos, títulos, backgrounds, skins, dados e outros itens
                virtuais existem apenas dentro das regras do Bellum Civile. Eles não
                representam moeda de curso legal, investimento financeiro ou direito de
                propriedade sobre arquivos, marcas ou outros ativos reais.
              </p>
              <p>
                Catálogo, disponibilidade, apresentação e critérios de obtenção podem
                mudar. Quando compras ou pagamentos reais forem disponibilizados,
                condições específicas de preço, reembolso e proteção ao consumidor
                aplicáveis à transação também deverão ser observadas.
              </p>
            </>
          ),
        },
        {
          title: "Serviços de terceiros",
          summary: "Login, hospedagem e outras partes do serviço podem depender de provedores externos.",
          content: (
            <p>
              Alguns recursos podem utilizar serviços ou plataformas de terceiros,
              como provedores de autenticação e infraestrutura. O uso desses serviços
              pode estar sujeito também aos respectivos termos e políticas. O Bellum
              Civile não controla práticas independentes de terceiros fora do escopo
              do serviço.
            </p>
          ),
        },
        {
          title: "Suspensão e encerramento",
          summary: "Violações graves ou riscos ao serviço podem resultar em restrição ou encerramento da conta.",
          content: (
            <>
              <p>
                Podemos suspender, limitar ou encerrar uma conta quando houver
                violação destes Termos, fraude, risco de segurança, abuso,
                comprometimento da integridade do jogo ou necessidade de cumprimento
                legal.
              </p>
              <p>
                A exclusão da conta pode não apagar imediatamente registros que devam
                ser preservados por obrigação legal, segurança, prevenção de fraude ou
                integridade histórica de partidas. Quando possível, esses registros
                podem ser desvinculados da identidade ativa do usuário.
              </p>
            </>
          ),
        },
        {
          title: "Propriedade intelectual",
          summary: "O jogo pode ser utilizado, mas sua propriedade intelectual não é transferida ao jogador.",
          content: (
            <p>
              Código, interface, identidade visual, textos, ilustrações, modelos,
              marcas, sons e demais elementos próprios do Bellum Civile são protegidos
              pela legislação aplicável e pertencem aos seus respectivos titulares. O
              acesso ao jogo não transfere esses direitos ao usuário.
            </p>
          ),
        },
        {
          title: "Garantias e responsabilidade",
          summary: "O serviço é fornecido sujeito às limitações técnicas normais de um jogo online e aos direitos obrigatórios do usuário.",
          content: (
            <>
              <p>
                Empregamos esforços razoáveis para manter o serviço seguro e
                funcional, mas sistemas online podem apresentar indisponibilidade,
                perda de conexão, bugs, incompatibilidades e interrupções.
              </p>
              <p>
                Qualquer limitação de responsabilidade prevista nestes Termos vale
                somente na extensão permitida pela legislação aplicável. Nada aqui
                pretende excluir garantia, direito do consumidor, dever de segurança
                ou outra obrigação que não possa ser legalmente afastada.
              </p>
            </>
          ),
        },
        {
          title: "Alterações destes Termos",
          summary: "A versão pública mais recente será mantida nesta página.",
          content: (
            <p>
              Estes Termos podem ser atualizados para refletir alterações no jogo,
              novas funcionalidades, mudanças operacionais ou requisitos legais.
              Mudanças relevantes poderão ser comunicadas dentro do serviço quando
              apropriado. A data da versão vigente permanece indicada no início deste
              documento.
            </p>
          ),
        },
      ]}
    />
  );
}
