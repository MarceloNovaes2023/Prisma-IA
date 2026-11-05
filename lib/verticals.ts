export type Stage = {
  key: string;
  label: string;
  /** probabilidade de fechamento usada no forecast ponderado */
  prob: number;
  kind?: "open" | "won" | "lost";
  /** etapa em que o lead deixa de precisar de follow-up */
  terminal?: boolean;
};

export type QualOption = { label: string; score: number };

export type QualQuestion = {
  key: string;
  label: string;
  weight: number;
  options: QualOption[];
};

export type CadenceStep = {
  /** dias após a entrada do lead (ou após a etapa anterior) */
  day: number;
  label: string;
  template: string;
  goal: string;
};

export type CashbackRule = {
  kind: "percent" | "fixed" | "none";
  value: number;
  minOrder: number;
  expiryDays: number;
  label: string;
  note: string;
};

export type Playbook = {
  offer: string;
  problem: string;
  kpis: { label: string; value: string }[];
  objections: { q: string; a: string }[];
  channels: string[];
  ticket: string;
  cycle: string;
};

export type Vertical = {
  slug: string;
  name: string;
  short: string;
  segment: "Imóveis" | "Moda" | "Saúde" | "Automotivo" | "Alimentação" | "Jurídico" | "Serviços";
  color: string;
  icon: string;
  stages: Stage[];
  qualification: QualQuestion[];
  cadence: CadenceStep[];
  cashback: CashbackRule;
  playbook: Playbook;
  /** campos extras coletados no formulário de captação */
  intakeFields: string[];
  /** roteiro de primeira resposta automática */
  greeting: string;
};

const leadStages = (prefix: string) => prefix;
void leadStages;

export const VERTICALS: Vertical[] = [
  {
    slug: "imobiliaria",
    name: "Imobiliárias e corretores",
    short: "Imobiliária",
    segment: "Imóveis",
    color: "#a3f04b",
    icon: "building",
    stages: [
      { key: "novo", label: "Novo lead", prob: 5 },
      { key: "qualificado", label: "Qualificado", prob: 20 },
      { key: "visita", label: "Visita agendada", prob: 45 },
      { key: "proposta", label: "Proposta", prob: 70 },
      { key: "fechado", label: "Contrato assinado", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "objetivo",
        label: "Objetivo da compra",
        weight: 25,
        options: [
          { label: "Morar agora", score: 100 },
          { label: "Investir", score: 70 },
          { label: "Pesquisando o mercado", score: 25 },
        ],
      },
      {
        key: "financiamento",
        label: "Forma de pagamento",
        weight: 30,
        options: [
          { label: "À vista / recursos próprios", score: 100 },
          { label: "Financiamento pré-aprovado", score: 85 },
          { label: "Vai iniciar o financiamento", score: 50 },
          { label: "Não sabe ainda", score: 20 },
        ],
      },
      {
        key: "prazo",
        label: "Prazo para fechar",
        weight: 25,
        options: [
          { label: "Até 30 dias", score: 100 },
          { label: "1 a 3 meses", score: 60 },
          { label: "Sem prazo definido", score: 15 },
        ],
      },
      {
        key: "faixa",
        label: "Faixa de investimento",
        weight: 20,
        options: [
          { label: "Acima do ticket médio", score: 100 },
          { label: "Dentro da faixa", score: 70 },
          { label: "Abaixo da faixa", score: 30 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Abertura",
        goal: "Confirmar interesse e coletar objetivo",
        template:
          "Oi {primeiro_nome}, aqui é {vendedor} da {empresa}. Vi que você se interessou pelo imóvel no bairro {bairro}. Ele ainda está disponível — você quer morar ou investir?",
      },
      {
        day: 1,
        label: "Dossiê do imóvel",
        goal: "Enviar fotos, planta e valor do condomínio",
        template:
          "{primeiro_nome}, separei o dossiê completo: fotos, planta e custos mensais. Quer que eu te envie também 2 opções parecidas na mesma região?",
      },
      {
        day: 3,
        label: "Prova social",
        goal: "Reduzir medo de decisão",
        template:
          "{primeiro_nome}, fechamos outro apartamento no mesmo prédio semana passada. Se você quiser, marco uma visita no sábado às 10h ou às 16h — qual fica melhor?",
      },
      {
        day: 7,
        label: "Escassez real",
        goal: "Criar urgência sem mentir",
        template:
          "{primeiro_nome}, o proprietário recebeu outra proposta nesse imóvel. Antes de eu responder pra ele, você tem interesse em visitar essa semana?",
      },
      {
        day: 14,
        label: "Reaquecimento",
        goal: "Manter na carteira para o próximo ciclo",
        template:
          "{primeiro_nome}, tudo bem? Deixei 3 imóveis novos que entraram abaixo do valor de mercado. Quer que eu te mande a lista?",
      },
    ],
    cashback: {
      kind: "fixed",
      value: 1000,
      minOrder: 0,
      expiryDays: 180,
      label: "R$ 1.000 em indicação",
      note: "Imobiliária não pratica cashback sobre venda; o valor vai para quem indica e fecha negócio.",
    },
    playbook: {
      offer: "Visita guiada com dossiê do imóvel em 24h",
      problem: "Lead de portal chega frio, o corretor demora e o cliente fecha com outra imobiliária.",
      kpis: [
        { label: "1ª resposta", value: "< 5 min" },
        { label: "Visita/lead", value: "18-25%" },
        { label: "Visita → proposta", value: "35%" },
      ],
      objections: [
        {
          q: "Vou pensar e te aviso",
          a: "Claro. Só me diz o que pesou mais: valor, localização ou condomínio? Assim eu já te mando opções que resolvem isso.",
        },
        {
          q: "Está caro",
          a: "Entendo. Temos 2 unidades no mesmo prédio com metragem menor e condomínio mais baixo. Quer comparar lado a lado?",
        },
        {
          q: "Já estou vendo com outra imobiliária",
          a: "Sem problema, o imóvel é o mesmo. Posso te mandar o comparativo de custos totais (ITBI, condomínio, financiamento) para você decidir com número na mão.",
        },
      ],
      channels: ["Instagram Ads", "Portais (ZAP/Viva Real)", "Google Ads"],
      ticket: "R$ 420 mil",
      cycle: "21 a 60 dias",
    },
    intakeFields: ["bairro", "tipo", "quartos", "faixa_preco"],
    greeting:
      "Oi {primeiro_nome}! Sou {vendedor}, da {empresa}. Recebi seu contato sobre o imóvel em {bairro}. Posso te fazer 3 perguntas rápidas para separar as melhores opções?",
  },
  {
    slug: "moda-atacado",
    name: "Moda feminina — atacado",
    short: "Atacado moda",
    segment: "Moda",
    color: "#9a86ff",
    icon: "shirt",
    stages: [
      { key: "novo", label: "Novo cadastro", prob: 8 },
      { key: "qualificado", label: "Revendedora validada", prob: 30 },
      { key: "catalogo", label: "Catálogo enviado", prob: 50 },
      { key: "pedido", label: "Pedido montado", prob: 80 },
      { key: "pago", label: "Pago", prob: 95 },
      { key: "enviado", label: "Enviado", prob: 98 },
      { key: "entregue", label: "Entregue", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "canal",
        label: "Onde revende",
        weight: 30,
        options: [
          { label: "Loja física", score: 100 },
          { label: "Instagram / WhatsApp", score: 75 },
          { label: "Feira / sacoleira", score: 60 },
          { label: "Só pesquisando", score: 15 },
        ],
      },
      {
        key: "volume",
        label: "Volume por pedido",
        weight: 35,
        options: [
          { label: "Acima de 100 peças", score: 100 },
          { label: "30 a 100 peças", score: 80 },
          { label: "10 a 30 peças", score: 55 },
          { label: "Menos de 10 peças", score: 25 },
        ],
      },
      {
        key: "cnpj",
        label: "Documentação",
        weight: 20,
        options: [
          { label: "CNPJ ativo", score: 100 },
          { label: "MEI em aberto", score: 70 },
          { label: "Pessoa física", score: 35 },
        ],
      },
      {
        key: "recorrencia",
        label: "Frequência de compra",
        weight: 15,
        options: [
          { label: "Toda semana", score: 100 },
          { label: "Quinzenal", score: 70 },
          { label: "Mensal", score: 45 },
          { label: "Primeira compra", score: 30 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Boas-vindas",
        goal: "Validar revendedora e pedir CNPJ",
        template:
          "Oi {primeiro_nome}! Seja bem-vinda à {empresa}. Para liberar a tabela de atacado, me confirma: você revende em loja física ou online?",
      },
      {
        day: 1,
        label: "Tabela + mínimos",
        goal: "Deixar preço e pedido mínimo claros",
        template:
          "{primeiro_nome}, aqui está a tabela atualizada. Pedido mínimo de 12 peças com preço de atacado e 30 dias para troca. Quer que eu monte um mix inicial de 15 peças com as mais vendidas?",
      },
      {
        day: 3,
        label: "Mix campeão",
        goal: "Reduzir risco de compra",
        template:
          "{primeiro_nome}, separei as 8 peças que mais saíram na última semana — todas com giro em até 15 dias. Te mando as fotos com preço de atacado?",
      },
      {
        day: 6,
        label: "Condição de fechamento",
        goal: "Fechar com frete ou brinde",
        template:
          "{primeiro_nome}, se fecharmos até sexta, o frete sai por nossa conta e você leva 2 peças de brinde. Quantas peças você quer colocar no primeiro pedido?",
      },
      {
        day: 12,
        label: "Recompra",
        goal: "Ativar recorrência",
        template:
          "{primeiro_nome}, como foi a saída das peças? Chegou coleção nova hoje e as clientes costumam comprar junto com o que você levou. Quer ver as novidades?",
      },
    ],
    cashback: {
      kind: "percent",
      value: 3,
      minOrder: 600,
      expiryDays: 90,
      label: "3% do pedido em crédito",
      note: "Crédito liberado 7 dias após a entrega e usado no pedido seguinte — aumenta recompra.",
    },
    playbook: {
      offer: "Mix inicial de 15 peças com giro comprovado e frete grátis no 1º pedido",
      problem: "Revendedora compara preço em 5 fornecedores e compra de quem responde rápido e dá segurança de troca.",
      kpis: [
        { label: "1º pedido", value: "35-45%" },
        { label: "Recompra 60d", value: "52%" },
        { label: "Ticket atacado", value: "R$ 1.850" },
      ],
      objections: [
        {
          q: "O preço está mais caro que o outro fornecedor",
          a: "Pode ser. Compara o preço por peça com a margem: nossa peça gira em 15 dias, a deles em 30. Quer que eu monte a conta com o seu giro?",
        },
        {
          q: "Preciso ver as peças antes",
          a: "Faz sentido. Te mando vídeo mostrando tecido, costura e caimento das 5 mais vendidas — e você decide sem sair da loja.",
        },
        {
          q: "Vou comprar mês que vem",
          a: "Combinado. Deixo reservado o mix dessa semana com o preço atual e te chamo dia 5. Se a coleção virar, o preço muda.",
        },
      ],
      channels: ["Instagram", "WhatsApp status", "Feiras do Brás / Goiânia"],
      ticket: "R$ 1.850",
      cycle: "3 a 10 dias",
    },
    intakeFields: ["cidade", "cnpj", "canal_venda", "volume"],
    greeting:
      "Oi {primeiro_nome}! Aqui é {vendedor}, da {empresa}. Você pediu a tabela de atacado — me confirma se revende em loja física ou online para eu liberar os preços?",
  },
  {
    slug: "moda-varejo",
    name: "Moda feminina — varejo",
    short: "Varejo moda",
    segment: "Moda",
    color: "#f2607a",
    icon: "shopping-bag",
    stages: [
      { key: "novo", label: "Novo contato", prob: 6 },
      { key: "interesse", label: "Interesse no produto", prob: 25 },
      { key: "carrinho", label: "Carrinho / separação", prob: 55 },
      { key: "pago", label: "Pago", prob: 90 },
      { key: "enviado", label: "Enviado", prob: 96 },
      { key: "entregue", label: "Entregue", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "peca",
        label: "Peça de interesse",
        weight: 25,
        options: [
          { label: "Definiu modelo e tamanho", score: 100 },
          { label: "Tem modelo, dúvida no tamanho", score: 65 },
          { label: "Só olhando", score: 20 },
        ],
      },
      {
        key: "urgencia",
        label: "Quando quer usar",
        weight: 30,
        options: [
          { label: "Essa semana", score: 100 },
          { label: "Esse mês", score: 65 },
          { label: "Sem data", score: 20 },
        ],
      },
      {
        key: "pagamento",
        label: "Forma de pagamento",
        weight: 25,
        options: [
          { label: "PIX à vista", score: 100 },
          { label: "Cartão", score: 80 },
          { label: "Boleto / parcelado", score: 50 },
        ],
      },
      {
        key: "primeira_compra",
        label: "Já comprou com a marca",
        weight: 20,
        options: [
          { label: "Cliente recorrente", score: 100 },
          { label: "Primeira compra", score: 60 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Dúvida de tamanho",
        goal: "Destravar a objeção número 1 do varejo",
        template:
          "Oi {primeiro_nome}! Aqui é {vendedor}, da {empresa}. Vi que você olhou o vestido {peca}. Me diz seu tamanho e altura que eu te falo exatamente qual serve em você.",
      },
      {
        day: 1,
        label: "Prova real",
        goal: "Mostrar a peça no corpo",
        template:
          "{primeiro_nome}, separei fotos da peça em 3 tipos de corpo e um vídeo do caimento. Quer que eu te mande?",
      },
      {
        day: 3,
        label: "Condição",
        goal: "Antecipar frete e troca",
        template:
          "{primeiro_nome}, hoje o frete sai grátis acima de R$ 199 e a primeira troca é por nossa conta. Quer que eu reserve a peça no seu tamanho?",
      },
      {
        day: 7,
        label: "Última chamada",
        goal: "Escassez real de estoque",
        template:
          "{primeiro_nome}, restaram 2 unidades no seu tamanho. Se quiser, gero o link de pagamento agora e você garante a peça.",
      },
      {
        day: 20,
        label: "Novo drop",
        goal: "Reativar com novidade",
        template:
          "{primeiro_nome}, entrou coleção nova e as clientes estão levando a {peca} junto. Quer ver antes de esgotar?",
      },
    ],
    cashback: {
      kind: "percent",
      value: 5,
      minOrder: 149,
      expiryDays: 60,
      label: "5% de volta na 1ª compra",
      note: "Crédito na carteira para a próxima compra em até 60 dias — eleva recompra em ~18%.",
    },
    playbook: {
      offer: "Consultoria de tamanho no WhatsApp + frete grátis acima de R$ 199",
      problem: "A cliente vê no Instagram, pergunta o tamanho, não recebe resposta na hora e esfria.",
      kpis: [
        { label: "Conversão DM", value: "12-18%" },
        { label: "Recompra 90d", value: "34%" },
        { label: "Ticket", value: "R$ 230" },
      ],
      objections: [
        {
          q: "Vou ver se sirvo",
          a: "Me manda sua altura e o tamanho que você usa na Zara, que eu acerto pra você — e se não servir, a troca é por nossa conta.",
        },
        {
          q: "Achei caro",
          a: "Entendo. Essa peça é forro duplo e não transparente; a versão barata que você viu é mais fina. Quer ver a comparação de tecido?",
        },
        {
          q: "Vou pensar",
          a: "Sem problema! Só um detalhe: restam 2 unidades desse tamanho. Quer que eu segure pra você até amanhã às 18h?",
        },
      ],
      channels: ["Instagram DM", "TikTok", "WhatsApp Click-to-chat"],
      ticket: "R$ 230",
      cycle: "1 a 5 dias",
    },
    intakeFields: ["peca", "tamanho", "cidade"],
    greeting:
      "Oi {primeiro_nome}! Aqui é {vendedor}, da {empresa} 💛 Você comentou na peça {peca} — quer saber sobre tamanho, tecido ou prazo de entrega?",
  },
  {
    slug: "estetica",
    name: "Clínicas de estética",
    short: "Estética",
    segment: "Saúde",
    color: "#4fd1c5",
    icon: "sparkles",
    stages: [
      { key: "novo", label: "Novo contato", prob: 8 },
      { key: "qualificado", label: "Qualificado", prob: 30 },
      { key: "avaliacao", label: "Avaliação agendada", prob: 55 },
      { key: "compareceu", label: "Compareceu", prob: 80 },
      { key: "procedimento", label: "Procedimento fechado", prob: 95 },
      { key: "retorno", label: "Retorno agendado", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "procedimento",
        label: "Procedimento desejado",
        weight: 30,
        options: [
          { label: "Já sabe o que quer", score: 100 },
          { label: "Quer indicação", score: 65 },
          { label: "Pesquisando preço", score: 25 },
        ],
      },
      {
        key: "urgencia",
        label: "Quando quer fazer",
        weight: 25,
        options: [
          { label: "Essa semana", score: 100 },
          { label: "Esse mês", score: 70 },
          { label: "Sem data", score: 20 },
        ],
      },
      {
        key: "investimento",
        label: "Investimento previsto",
        weight: 25,
        options: [
          { label: "Acima de R$ 1.500", score: 100 },
          { label: "R$ 500 a R$ 1.500", score: 65 },
          { label: "Abaixo de R$ 500", score: 30 },
        ],
      },
      {
        key: "experiencia",
        label: "Já fez procedimento",
        weight: 20,
        options: [
          { label: "Já é paciente", score: 100 },
          { label: "Já fez em outra clínica", score: 70 },
          { label: "Primeira vez", score: 45 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Triagem",
        goal: "Entender procedimento e urgência",
        template:
          "Oi {primeiro_nome}! Sou {vendedor}, da {empresa}. Você quer fazer o {procedimento} em quanto tempo? Assim eu já te falo a agenda e o valor da avaliação.",
      },
      {
        day: 1,
        label: "Antes e depois",
        goal: "Prova social com resultado real",
        template:
          "{primeiro_nome}, separei 3 casos de {procedimento} com fotos de antes e depois (autorizadas). Quer ver o resultado e o tempo de recuperação?",
      },
      {
        day: 2,
        label: "Agenda",
        goal: "Marcar avaliação com horário fechado",
        template:
          "{primeiro_nome}, tenho quinta às 15h e sábado às 10h para avaliação gratuita. Qual dos dois fica melhor?",
      },
      {
        day: 5,
        label: "Reduzir medo",
        goal: "Explicar segurança e protocolo",
        template:
          "{primeiro_nome}, muitas pacientes chegam com receio de dor e de ficar marcada. O protocolo daqui inclui anestesia tópica e retorno em 7 dias. Quer que eu te explique como funciona?",
      },
      {
        day: 10,
        label: "Reativação",
        goal: "Recuperar quem não compareceu",
        template:
          "{primeiro_nome}, notei que você não conseguiu vir na avaliação. Abri dois horários essa semana — quer que eu reserve um pra você?",
      },
    ],
    cashback: {
      kind: "percent",
      value: 8,
      minOrder: 250,
      expiryDays: 90,
      label: "8% em crédito para retorno",
      note: "Crédito só em procedimentos, nunca em dinheiro — mantém o retorno e não fere regra de publicidade.",
    },
    playbook: {
      offer: "Avaliação gratuita com plano de tratamento personalizado e retorno incluso",
      problem: "Lead pergunta preço no direct, recebe tabela seca e desaparece; falta follow-up de quem não compareceu.",
      kpis: [
        { label: "Agendamento", value: "42%" },
        { label: "Comparecimento", value: "78%" },
        { label: "Ticket", value: "R$ 1.400" },
      ],
      objections: [
        {
          q: "Quanto custa?",
          a: "Depende da área e do protocolo: o {procedimento} começa em R$ X. Na avaliação gratuita eu te dou o valor exato, sem compromisso. Quinta às 15h ou sábado às 10h?",
        },
        {
          q: "Dói?",
          a: "Usamos anestesia tópica e o desconforto é leve, tipo ardência por 20 minutos. 9 de 10 pacientes voltam para a manutenção.",
        },
        {
          q: "Vou pensar",
          a: "Tranquilo. Só me conta: a dúvida é preço, dor ou resultado? Eu te respondo direto e você decide sem pressão.",
        },
      ],
      channels: ["Instagram DM", "Google Meu Negócio", "Indicação"],
      ticket: "R$ 1.400",
      cycle: "2 a 14 dias",
    },
    intakeFields: ["procedimento", "regiao", "ja_fez"],
    greeting:
      "Oi {primeiro_nome}! Aqui é {vendedor}, da {empresa}. Sobre o {procedimento}: a avaliação é gratuita e dura 30 min. Você prefere manhã ou tarde?",
  },
  {
    slug: "odontologia",
    name: "Clínicas odontológicas",
    short: "Odontologia",
    segment: "Saúde",
    color: "#7cc4ff",
    icon: "tooth",
    stages: [
      { key: "novo", label: "Novo contato", prob: 10 },
      { key: "qualificado", label: "Qualificado", prob: 35 },
      { key: "avaliacao", label: "Avaliação agendada", prob: 60 },
      { key: "orcamento", label: "Orçamento entregue", prob: 75 },
      { key: "tratamento", label: "Tratamento iniciado", prob: 95 },
      { key: "retorno", label: "Em manutenção", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "tratamento",
        label: "Necessidade principal",
        weight: 30,
        options: [
          { label: "Urgência / dor", score: 100 },
          { label: "Estética (clareamento, lentes)", score: 80 },
          { label: "Avaliação geral", score: 45 },
        ],
      },
      {
        key: "convenio",
        label: "Pagamento",
        weight: 25,
        options: [
          { label: "Particular à vista", score: 100 },
          { label: "Cartão / parcelado", score: 75 },
          { label: "Depende do convênio", score: 40 },
        ],
      },
      {
        key: "prazo",
        label: "Quando quer começar",
        weight: 25,
        options: [
          { label: "Essa semana", score: 100 },
          { label: "Esse mês", score: 65 },
          { label: "Sem data", score: 20 },
        ],
      },
      {
        key: "distancia",
        label: "Facilidade de acesso",
        weight: 20,
        options: [
          { label: "Mesmo bairro", score: 100 },
          { label: "Mesma cidade", score: 65 },
          { label: "Outra cidade", score: 30 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Triagem",
        goal: "Identificar dor ou estética",
        template:
          "Oi {primeiro_nome}! Sou {vendedor}, da {empresa}. Você está com dor agora ou quer avaliar estética (clareamento, lentes)?",
      },
      {
        day: 1,
        label: "Agenda com horário",
        goal: "Fechar a avaliação",
        template:
          "{primeiro_nome}, tenho encaixe amanhã às 9h e às 16h para avaliação com raio-x. Qual você prefere?",
      },
      {
        day: 3,
        label: "Tabela transparente",
        goal: "Antecipar orçamento",
        template:
          "{primeiro_nome}, para você não ter surpresa: a avaliação é R$ 0 e o clareamento fica a partir de R$ X, em até 10x sem juros. Quer ver os casos que fizemos?",
      },
      {
        day: 7,
        label: "Consequência",
        goal: "Criar urgência clínica real",
        template:
          "{primeiro_nome}, quando a dor passa, o problema continua. Se você deixar para depois, o tratamento costuma virar canal. Quer garantir o horário dessa semana?",
      },
      {
        day: 15,
        label: "Reativação",
        goal: "Recuperar orçamento parado",
        template:
          "{primeiro_nome}, seu orçamento está reservado aqui. Se o valor foi o problema, consigo dividir de outro jeito — quer que eu veja?",
      },
    ],
    cashback: {
      kind: "percent",
      value: 5,
      minOrder: 400,
      expiryDays: 180,
      label: "5% em clareamento/estética",
      note: "Válido para tratamentos estéticos, nunca para o procedimento clínico — evita conflito com regra do CFO.",
    },
    playbook: {
      offer: "Avaliação com raio-x inclusa e orçamento em até 24h",
      problem: "Paciente com dor liga, não consegue horário rápido e vai para o pronto-socorro ou para o concorrente.",
      kpis: [
        { label: "Agendamento", value: "48%" },
        { label: "Comparecimento", value: "82%" },
        { label: "Orçamento → execução", value: "61%" },
      ],
      objections: [
        {
          q: "O convênio cobre?",
          a: "Aqui é particular, mas o orçamento sai mais barato que muitos convênios com coparticipação. Quer comparar com o que você paga hoje?",
        },
        {
          q: "Está caro",
          a: "Entendo. Em até 10x sem juros fica R$ X por mês. E se a gente começar pelo dente que está doendo, o custo cai pela metade agora.",
        },
        {
          q: "Tenho medo de dentista",
          a: "Muita gente chega assim. A gente combina um sinal de mão para eu parar na hora, e começamos só com o exame. Quer marcar assim?",
        },
      ],
      channels: ["Google Ads", "Instagram", "Indicação"],
      ticket: "R$ 1.900",
      cycle: "1 a 21 dias",
    },
    intakeFields: ["tratamento", "convenio", "cidade"],
    greeting:
      "Oi {primeiro_nome}! Aqui é {vendedor}, da {empresa}. Você está com dor ou quer avaliação estética? Consigo encaixar avaliação com raio-x essa semana.",
  },
  {
    slug: "automoveis",
    name: "Lojas de carros",
    short: "Automóveis",
    segment: "Automotivo",
    color: "#f5b841",
    icon: "car",
    stages: [
      { key: "novo", label: "Novo lead", prob: 6 },
      { key: "qualificado", label: "Qualificado", prob: 25 },
      { key: "testdrive", label: "Test drive agendado", prob: 50 },
      { key: "proposta", label: "Proposta / negociação", prob: 72 },
      { key: "financiamento", label: "Financiamento aprovado", prob: 90 },
      { key: "vendido", label: "Vendido", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "veiculo",
        label: "Veículo de interesse",
        weight: 20,
        options: [
          { label: "Modelo e ano definidos", score: 100 },
          { label: "Definiu categoria", score: 65 },
          { label: "Só olhando", score: 20 },
        ],
      },
      {
        key: "pagamento",
        label: "Forma de pagamento",
        weight: 30,
        options: [
          { label: "À vista", score: 100 },
          { label: "Financiamento pré-aprovado", score: 85 },
          { label: "Troca + financiamento", score: 65 },
          { label: "Não sabe", score: 25 },
        ],
      },
      {
        key: "troca",
        label: "Veículo na troca",
        weight: 20,
        options: [
          { label: "Sem troca", score: 90 },
          { label: "Com troca quitada", score: 75 },
          { label: "Com troca financiada", score: 40 },
        ],
      },
      {
        key: "prazo",
        label: "Quando quer comprar",
        weight: 30,
        options: [
          { label: "Essa semana", score: 100 },
          { label: "Esse mês", score: 65 },
          { label: "Sem prazo", score: 15 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Confirmação",
        goal: "Confirmar veículo e disponibilidade",
        template:
          "Oi {primeiro_nome}! Sou {vendedor}, da {empresa}. O {veiculo} ainda está disponível. Você pretende pagar à vista, financiar ou dar um na troca?",
      },
      {
        day: 1,
        label: "Vídeo do carro",
        goal: "Mostrar estado real e reduzir objeção",
        template:
          "{primeiro_nome}, gravei um vídeo mostrando o carro por dentro e por fora, com a quilometragem no painel. Quer receber?",
      },
      {
        day: 2,
        label: "Test drive",
        goal: "Trazer para a loja",
        template:
          "{primeiro_nome}, consigo te esperar amanhã às 10h ou sábado às 9h para o test drive. Você prefere qual?",
      },
      {
        day: 5,
        label: "Simulação",
        goal: "Mostrar parcela real",
        template:
          "{primeiro_nome}, fiz uma simulação: entrada de R$ X e parcela de R$ Y em 48x. Se eu ajustar a entrada, a parcela cai. Quer que eu simule com o seu valor?",
      },
      {
        day: 12,
        label: "Reaquecimento",
        goal: "Recuperar quem não veio",
        template:
          "{primeiro_nome}, chegou um {veiculo} igual com km menor e ainda com garantia de fábrica. Quer que eu te avise antes de anunciar?",
      },
    ],
    cashback: {
      kind: "fixed",
      value: 800,
      minOrder: 0,
      expiryDays: 180,
      label: "R$ 800 em acessórios",
      note: "Aplicado como bônus em acessórios/revisão na entrega — cashback em dinheiro não é prática do setor.",
    },
    playbook: {
      offer: "Test drive agendado + simulação de parcela em 5 minutos",
      problem: "Lead de portal preenche formulário e some; quem responde em 1h perde para quem responde em 5 min.",
      kpis: [
        { label: "1ª resposta", value: "< 3 min" },
        { label: "Test drive/lead", value: "22%" },
        { label: "Test drive → venda", value: "31%" },
      ],
      objections: [
        {
          q: "Está caro, vi mais barato",
          a: "Pode ser que tenha. Compara a quilometragem e a garantia: o nosso tem laudo cautelar e 3 meses de garantia. Quer que eu te mande o laudo?",
        },
        {
          q: "Vou pensar",
          a: "Tranquilo. Só me diz: o que pesou mais, a parcela ou o carro? Se for a parcela, eu ajusto a entrada e te mostro um número melhor.",
        },
        {
          q: "Meu financiamento não foi aprovado",
          a: "Já aconteceu com outros clientes. Trabalhamos com 6 bancos e uma financeira própria; me manda o CPF que eu faço a simulação agora.",
        },
      ],
      channels: ["Portais (Webmotors/iCarros)", "Instagram", "Facebook Marketplace"],
      ticket: "R$ 68 mil",
      cycle: "3 a 30 dias",
    },
    intakeFields: ["veiculo", "pagamento", "troca", "cidade"],
    greeting:
      "Oi {primeiro_nome}! Aqui é {vendedor}, da {empresa}. Sobre o {veiculo}: ele está disponível. Você quer financiar, pagar à vista ou dar um na troca?",
  },
  {
    slug: "restaurante",
    name: "Restaurantes e delivery",
    short: "Restaurante",
    segment: "Alimentação",
    color: "#ff9f6b",
    icon: "utensils",
    stages: [
      { key: "novo", label: "Novo contato", prob: 12 },
      { key: "qualificado", label: "Interesse confirmado", prob: 40 },
      { key: "reserva", label: "Reserva / pedido", prob: 70 },
      { key: "compareceu", label: "Compareceu", prob: 92 },
      { key: "recompra", label: "Recompra", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "ocasiao",
        label: "Ocasião",
        weight: 30,
        options: [
          { label: "Aniversário / comemoração", score: 100 },
          { label: "Encontro / casal", score: 80 },
          { label: "Almoço de trabalho", score: 60 },
          { label: "Só olhando cardápio", score: 25 },
        ],
      },
      {
        key: "pessoas",
        label: "Quantas pessoas",
        weight: 25,
        options: [
          { label: "Grupo de 6+", score: 100 },
          { label: "3 a 5", score: 75 },
          { label: "1 a 2", score: 45 },
        ],
      },
      {
        key: "quando",
        label: "Quando",
        weight: 30,
        options: [
          { label: "Hoje / amanhã", score: 100 },
          { label: "Essa semana", score: 70 },
          { label: "Sem data", score: 20 },
        ],
      },
      {
        key: "restricao",
        label: "Restrição alimentar",
        weight: 15,
        options: [
          { label: "Nenhuma", score: 100 },
          { label: "Tem restrição", score: 70 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Reserva",
        goal: "Converter dúvida em mesa",
        template:
          "Oi {primeiro_nome}! Aqui é {vendedor}, do {empresa}. Você quer mesa para quantas pessoas e em qual dia? Já reservo o melhor horário.",
      },
      {
        day: 1,
        label: "Cardápio",
        goal: "Mostrar prato e preço",
        template:
          "{primeiro_nome}, te mando o cardápio da semana com os pratos que mais saem. Tem opção sem glúten e vegetariana. Quer a carta de drinks também?",
      },
      {
        day: 2,
        label: "Experiência",
        goal: "Reduzir risco com prova social",
        template:
          "{primeiro_nome}, no sábado tem música ao vivo a partir das 20h. As mesas da varanda são as mais pedidas — quer que eu segure uma pra você?",
      },
      {
        day: 7,
        label: "Reativação",
        goal: "Trazer de volta",
        template:
          "{primeiro_nome}, essa semana tem prato novo no menu e sobremesa cortesia para quem reservar pelo WhatsApp. Quer garantir?",
      },
      {
        day: 25,
        label: "Pós-visita",
        goal: "Pedir avaliação e recompra",
        template:
          "{primeiro_nome}, como foi sua experiência? Se quiser, deixo sua mesa preferida reservada para a próxima — e você ganha 10% de volta.",
      },
    ],
    cashback: {
      kind: "percent",
      value: 10,
      minOrder: 60,
      expiryDays: 30,
      label: "10% de volta",
      note: "Crédito para a próxima visita em 30 dias — o programa de fidelidade que mais funciona em food service.",
    },
    playbook: {
      offer: "Reserva pelo WhatsApp com mesa preferida e 10% de cashback na próxima visita",
      problem: "Cliente pergunta o cardápio no direct e não reserva; sem base própria, o restaurante depende de iFood.",
      kpis: [
        { label: "Reserva/lead", value: "55%" },
        { label: "No-show", value: "< 12%" },
        { label: "Recompra 30d", value: "41%" },
      ],
      objections: [
        {
          q: "Tem mesa hoje?",
          a: "Tenho sim, às 20h e 21h30 na varanda. Reservo no seu nome para quantas pessoas?",
        },
        {
          q: "É caro?",
          a: "O prato principal fica entre R$ 45 e R$ 79 e serve bem duas pessoas. Quer que eu te mande o cardápio com preços?",
        },
        {
          q: "Vou pedir pelo iFood",
          a: "Pode pedir, mas pelo WhatsApp o delivery sai sem a taxa da plataforma e o cashback de 10% entra na hora. Quer o link?",
        },
      ],
      channels: ["Instagram", "Google Maps", "WhatsApp"],
      ticket: "R$ 180",
      cycle: "0 a 7 dias",
    },
    intakeFields: ["pessoas", "data", "ocasiao"],
    greeting:
      "Oi {primeiro_nome}! Aqui é {vendedor}, do {empresa}. Mesa para quantas pessoas e em qual dia? Já te falo os horários disponíveis.",
  },
  {
    slug: "advocacia",
    name: "Advocacia",
    short: "Advocacia",
    segment: "Jurídico",
    color: "#c9b6ff",
    icon: "scale",
    stages: [
      { key: "novo", label: "Novo contato", prob: 8 },
      { key: "triagem", label: "Triagem do caso", prob: 30 },
      { key: "consulta", label: "Consulta agendada", prob: 55 },
      { key: "proposta", label: "Proposta de honorários", prob: 75 },
      { key: "contrato", label: "Contrato assinado", prob: 95 },
      { key: "ativo", label: "Caso ativo", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "area",
        label: "Área do direito",
        weight: 30,
        options: [
          { label: "Área atendida pelo escritório", score: 100 },
          { label: "Área parceira", score: 60 },
          { label: "Fora do escopo", score: 0 },
        ],
      },
      {
        key: "prazo",
        label: "Prazo / urgência",
        weight: 30,
        options: [
          { label: "Prazo legal correndo", score: 100 },
          { label: "Próximos 30 dias", score: 70 },
          { label: "Sem urgência", score: 35 },
        ],
      },
      {
        key: "documentos",
        label: "Documentação",
        weight: 20,
        options: [
          { label: "Tem tudo em mãos", score: 100 },
          { label: "Tem parte", score: 60 },
          { label: "Não tem nada", score: 25 },
        ],
      },
      {
        key: "honorarios",
        label: "Expectativa de honorários",
        weight: 20,
        options: [
          { label: "Aceita êxito + fixo", score: 100 },
          { label: "Só êxito", score: 65 },
          { label: "Quer gratuito / defensoria", score: 15 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Triagem ética",
        goal: "Entender o caso sem prometer resultado",
        template:
          "Olá {primeiro_nome}, aqui é {vendedor}, do {empresa}. Para eu direcionar seu caso ao advogado responsável: qual é o assunto e existe prazo ou audiência marcada?",
      },
      {
        day: 1,
        label: "Consulta",
        goal: "Agendar análise do caso",
        template:
          "{primeiro_nome}, o advogado tem horário para análise do caso amanhã às 14h ou quinta às 10h. A consulta dura 40 min. Qual prefere?",
      },
      {
        day: 3,
        label: "Checklist",
        goal: "Adiantar documentos",
        template:
          "{primeiro_nome}, para adiantar, separe: documento com foto, comprovante de residência e os documentos do caso. Se puder mandar foto aqui, já analisamos antes da consulta.",
      },
      {
        day: 7,
        label: "Follow-up consultivo",
        goal: "Recuperar quem não agendou",
        template:
          "{primeiro_nome}, passando para saber se ficou alguma dúvida sobre a consulta. Se preferir, posso te explicar como funciona o atendimento por vídeo.",
      },
      {
        day: 15,
        label: "Reativação",
        goal: "Manter o contato antes do prazo",
        template:
          "{primeiro_nome}, se o prazo do seu caso ainda estiver correndo, vale conversar essa semana. Quer que eu verifique um horário?",
      },
    ],
    cashback: {
      kind: "none",
      value: 0,
      minOrder: 0,
      expiryDays: 0,
      label: "Sem cashback",
      note: "Captação com vantagem financeira é vedada pelo Provimento 205/2021 da OAB. Aqui o funil usa conteúdo e indicação.",
    },
    playbook: {
      offer: "Análise inicial do caso com advogado responsável em 24h",
      problem: "Contato chega por indicação e ninguém faz triagem; caso sem prazo morre na caixa de entrada.",
      kpis: [
        { label: "Triagem → consulta", value: "46%" },
        { label: "Consulta → contrato", value: "57%" },
        { label: "Ticket", value: "R$ 4.200" },
      ],
      objections: [
        {
          q: "Quanto vou receber?",
          a: "Não é possível garantir resultado — o que posso dizer é o que a lei e a jurisprudência do seu tribunal indicam. Na consulta o advogado te mostra cenários reais.",
        },
        {
          q: "Está caro",
          a: "Trabalhamos com honorário inicial + êxito, então o custo acompanha o resultado. Na consulta a gente monta o formato que cabe no seu caso.",
        },
        {
          q: "Vou ver com outro advogado",
          a: "Recomendo mesmo comparar. Só confira se ele atua na sua área e se o prazo está preservado — se quiser, te explico o que perguntar.",
        },
      ],
      channels: ["Google Ads", "Instagram (conteúdo)", "Indicação"],
      ticket: "RN 4.200",
      cycle: "5 a 45 dias",
    },
    intakeFields: ["area", "prazo", "cidade"],
    greeting:
      "Olá {primeiro_nome}, aqui é {vendedor}, do {empresa}. Para direcionar seu caso: qual é o assunto e existe prazo ou audiência marcada?",
  },
  {
    slug: "contabilidade",
    name: "Contabilidade",
    short: "Contabilidade",
    segment: "Serviços",
    color: "#8fd694",
    icon: "calculator",
    stages: [
      { key: "novo", label: "Novo contato", prob: 8 },
      { key: "qualificado", label: "Qualificado", prob: 30 },
      { key: "diagnostico", label: "Diagnóstico agendado", prob: 55 },
      { key: "proposta", label: "Proposta enviada", prob: 75 },
      { key: "contrato", label: "Contrato assinado", prob: 95 },
      { key: "onboarding", label: "Onboarding concluído", prob: 100, kind: "won", terminal: true },
      { key: "perdido", label: "Perdido", prob: 0, kind: "lost", terminal: true },
    ],
    qualification: [
      {
        key: "regime",
        label: "Regime tributário",
        weight: 30,
        options: [
          { label: "Simples Nacional", score: 80 },
          { label: "Lucro Presumido", score: 100 },
          { label: "MEI", score: 45 },
          { label: "Não sabe", score: 55 },
        ],
      },
      {
        key: "faturamento",
        label: "Faturamento mensal",
        weight: 30,
        options: [
          { label: "Acima de R$ 100 mil", score: 100 },
          { label: "R$ 30 mil a R$ 100 mil", score: 80 },
          { label: "Até R$ 30 mil", score: 50 },
          { label: "Ainda não abriu", score: 25 },
        ],
      },
      {
        key: "dor",
        label: "Principal dor",
        weight: 25,
        options: [
          { label: "Multa / atraso com Receita", score: 100 },
          { label: "Imposto alto", score: 85 },
          { label: "Falta de relatório", score: 65 },
          { label: "Só trocar de contador", score: 50 },
        ],
      },
      {
        key: "urgencia",
        label: "Quando quer trocar",
        weight: 15,
        options: [
          { label: "Este mês", score: 100 },
          { label: "Próximo mês", score: 70 },
          { label: "Sem data", score: 25 },
        ],
      },
    ],
    cadence: [
      {
        day: 0,
        label: "Diagnóstico",
        goal: "Entender regime e dor",
        template:
          "Oi {primeiro_nome}! Sou {vendedor}, da {empresa}. Qual o regime da sua empresa hoje (Simples, Presumido ou MEI) e o que mais te incomoda na contabilidade atual?",
      },
      {
        day: 1,
        label: "Comparativo",
        goal: "Mostrar economia com número",
        template:
          "{primeiro_nome}, com o seu faturamento dá para comparar Simples x Presumido. Já vi empresa do seu porte economizar 18% de imposto. Quer que eu faça essa conta?",
      },
      {
        day: 3,
        label: "Diagnóstico gratuito",
        goal: "Agendar reunião de 30 min",
        template:
          "{primeiro_nome}, faço um diagnóstico gratuito de 30 min e te mostro 3 pontos de risco fiscal. Consigo amanhã às 11h ou quinta às 16h. Qual fica melhor?",
      },
      {
        day: 7,
        label: "Prova social",
        goal: "Reduzir medo de trocar",
        template:
          "{primeiro_nome}, migramos 12 empresas do seu segmento este ano sem nenhuma interrupção de folha ou nota. Quer falar com um deles?",
      },
      {
        day: 15,
        label: "Prazo fiscal",
        goal: "Usar o calendário como urgência",
        template:
          "{primeiro_nome}, se a troca acontecer até o dia 20, já entra na apuração do mês que vem sem custo extra. Quer que eu prepare a proposta?",
      },
    ],
    cashback: {
      kind: "none",
      value: 0,
      minOrder: 0,
      expiryDays: 0,
      label: "Sem cashback",
      note: "O CFC veda compartilhamento de honorários. Use desconto na 1ª mensalidade ou mês grátis no onboarding.",
    },
    playbook: {
      offer: "Diagnóstico fiscal gratuito com comparativo de regime tributário",
      problem: "Empresa só troca de contador quando leva multa; ninguém acompanha a régua de vencimentos do cliente.",
      kpis: [
        { label: "Diagnóstico/lead", value: "38%" },
        { label: "Proposta → contrato", value: "44%" },
        { label: "Ticket", value: "R$ 890/mês" },
      ],
      objections: [
        {
          q: "Meu contador já resolve",
          a: "Que bom. Só vale a comparação: você recebe relatório de fluxo de caixa todo mês? Se não, o diagnóstico mostra o que está faltando.",
        },
        {
          q: "Tem multa para trocar?",
          a: "Não. A troca é só uma comunicação e a transferência dos arquivos; a gente cuida disso e não deixa nenhum prazo em aberto.",
        },
        {
          q: "Vou pensar",
          a: "Claro. Só atenção ao prazo: se passar do dia 20, a apuração deste mês já fica com o contador antigo. Quer que eu te avise antes?",
        },
      ],
      channels: ["Google Ads", "Indicação", "LinkedIn"],
      ticket: "R$ 890/mês",
      cycle: "7 a 30 dias",
    },
    intakeFields: ["regime", "faturamento", "segmento"],
    greeting:
      "Oi {primeiro_nome}! Aqui é {vendedor}, da {empresa}. Qual o regime da sua empresa hoje e o que mais te incomoda na contabilidade atual?",
  },
];

export const verticalBySlug = (slug: string): Vertical | undefined =>
  VERTICALS.find((v) => v.slug === slug);

export const verticalName = (slug: string): string =>
  verticalBySlug(slug)?.short ?? slug;

export function stageOf(slug: string, key: string): Stage | undefined {
  return verticalBySlug(slug)?.stages.find((s) => s.key === key);
}

/** previsão ponderada: valor do lead × probabilidade da etapa */
export function weightedValue(slug: string, stage: string, value: number): number {
  const stageCfg = stageOf(slug, stage);
  if (!stageCfg || stageCfg.kind === "lost" || stageCfg.kind === "won") return 0;
  return Math.round((value * stageCfg.prob) / 100);
}

/** Compara rótulos ignorando acento, caixa e espaços extras (integrações mandam texto livre). */
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Alfredo Soares Method - Enhanced lead scoring that focuses on
 * qualifying leads properly (selling better, not just more)
 * Considers: intent, budget, timeline, authority, and need
 * Philosophy: Alfredo believes everyone can sell better with the right process
 */
export function scoreLead(slug: string, answers: Record<string, string | undefined>): number {
  const vertical = verticalBySlug(slug);
  if (!vertical) return 0;
  let total = 0;
  let weight = 0;
  for (const question of vertical.qualification) {
    weight += question.weight;
    // Alfredo Soares: pergunto, não suppomo. Sem resposta, desconfio da qualidade do lead.
    if (!answer) {
      // Lead without full qualification gets reduced confidence
      continue;
    }
    const normalized = normalizeLabel(answer);
    const option = question.options.find((o) => normalizeLabel(o.label) === normalized);
    if (option) {
      // Differencial Alfredo: pesos diferenciados por importância da pergunta
      // Perguntas com peso maior têm mais influência no score final
      const importanceMultiplier = question.weight / 30; // Normaliza peso 0-30 para 0-1
      total += (option.score * question.weight * importanceMultiplier) / 100;
    }
  }
  // Alfredo: se muitas respostas faltam, a confiança no lead diminui
  const answeredRatio = vertical.qualification.length > 0 ? weight / 100 : 0;
  const adjustedScore = weight >= 70 ? Math.round((total / weight) * 100) : Math.round((total / weight) * 100) * answeredRatio;
  return Math.max(0, Math.min(100, adjustedScore));
}

/** Alfredo Soares Method - Score band with actionable insights
 * Beyond hot/warm/cold: tells what action to take and when to follow up
 * Philosophy: sell better (not just more) through proper qualification
 * The action field tells the vendedor exactly what to do next
 */
export function scoreBand(score: number): { label: string; tone: "hot" | "warm" | "cold"; action: string; followupDays: number } {
  if (score >= 75) {
    return {
      label: "Quente",
      tone: "hot",
      action: "Fechar proposta imediatamente - lead com alta intenção de compra",
      followupDays: 1,
    };
  }
  if (score >= 45) {
    return {
      label: "Morno",
      tone: "warm",
      action: "Enviar conteúdo educativo e agendar próximo contato",
      followupDays: 3,
    };
  }
  return {
    label: "Frio",
    tone: "cold",
    action: "Iniciar nutrição com playbook de conscientização",
    followupDays: 7,
  };
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? `{${key}}`);
}