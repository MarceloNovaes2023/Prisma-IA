import type { DatabaseSync } from "node:sqlite";
import { buildSeries, dateOnly, fingerprintOf, momentumOf, winningScore } from "./score";

/* ------------------------------------------------------------------ */
/* Base de demonstração: anúncios sintéticos, porém realistas          */
/* ------------------------------------------------------------------ */

type Brand = {
  name: string;
  domain: string;
  vertical: string;
  product: string;
  benefit: string;
  price: number;
  tech: string[];
  verified: boolean;
  heat: number;
  city: string;
  gender: "all" | "male" | "female";
  affiliate?: { network: string; id: string };
  lpTitle: string;
};

type VerticalMeta = {
  pain: string;
  painDetail: string;
  objection: string;
  answer: string;
  specialist: string;
  proof: string;
  outcome: string;
  keywords: string[];
  ageMin: number;
  ageMax: number;
};

const VERTICAL_META: Record<string, VerticalMeta> = {
  "moda-atacado": {
    pain: "comprar cartela fechada e metade encalhar",
    painDetail: "Você compra 40 peças e só 12 saem da arara",
    objection: "E se não vender?",
    answer: "Trocamos qualquer peça que não girar em 30 dias. Você fica só com o que vendeu.",
    specialist: "quem vive de atacado há 12 anos",
    proof: "grade pensada para girar em 30 dias",
    outcome: "girar a grade em 30 dias",
    keywords: ["atacado", "grade", "coleção", "revenda", "peças"],
    ageMin: 24,
    ageMax: 45,
  },
  "moda-varejo": {
    pain: "montar look que não combina",
    painDetail: "Você compra peça solta e nunca fecha um look inteiro",
    objection: "E se não servir?",
    answer: "Primeira troca é gratuita, com etiqueta de devolução já dentro da caixa.",
    specialist: "quem veste 30 clientes por semana",
    proof: "looks completos montados por stylist",
    outcome: "acertar o look de primeira",
    keywords: ["look", "vestido", "alfaiataria", "coleção", "tamanho"],
    ageMin: 22,
    ageMax: 44,
  },
  estetica: {
    pain: "pagar caro e ver resultado que volta em 3 meses",
    painDetail: "Você já fez sessão demais e a pele voltou ao que era",
    objection: "Dói?",
    answer: "Não. Usamos anestésico tópico e protocolo sem agulha na primeira sessão.",
    specialist: "biomédica com 9 anos de clínica",
    proof: "protocolo com avaliação antes e depois",
    outcome: "ver diferença em 30 dias",
    keywords: ["avaliação", "pele", "harmonização", "protocolo", "sessão"],
    ageMin: 26,
    ageMax: 52,
  },
  odontologia: {
    pain: "sorrir com a mão na frente",
    painDetail: "Você evita foto, evita reunião, evita rir",
    objection: "Quanto tempo fico sem dente?",
    answer: "Com carga imediata, você sai da cadeira com dente provisório no mesmo dia.",
    specialist: "implantodontista com 4 mil casos",
    proof: "tomografia e planejamento digital inclusos",
    outcome: "voltar a sorrir em uma semana",
    keywords: ["implante", "clareamento", "avaliação", "sorriso", "radiografia"],
    ageMin: 30,
    ageMax: 62,
  },
  imobiliaria: {
    pain: "pagar aluguel que nunca volta",
    painDetail: "Doze meses de aluguel e nada no seu nome",
    objection: "E se eu não for aprovado no financiamento?",
    answer: "Analisamos três bancos e você vê a parcela aprovada antes de assinar qualquer coisa.",
    specialist: "corretor com 340 financiamentos aprovados",
    proof: "documentação revisada antes da visita",
    outcome: "sair com a chave na mão",
    keywords: ["apartamento", "financiamento", "entrada", "visita", "chaves"],
    ageMin: 27,
    ageMax: 55,
  },
  automoveis: {
    pain: "carro que vive na oficina",
    painDetail: "Você paga parcela e ainda paga mecânico",
    objection: "E a garantia?",
    answer: "Garantia de 12 meses no motor e câmbio, com vistoria de 180 itens anexada.",
    specialist: "consultor com 11 anos em seminovos",
    proof: "laudo cautelar e histórico completo",
    outcome: "trocar de carro sem dor de cabeça",
    keywords: ["seminovo", "financiamento", "test drive", "garantia", "laudo"],
    ageMin: 25,
    ageMax: 58,
  },
  restaurante: {
    pain: "pedir delivery e receber comida fria",
    painDetail: "Você paga entrega e a comida chega murcha",
    objection: "Demora muito?",
    answer: "Média de 32 minutos no raio de 5 km e, se passar de 50, a sobremesa é por nossa conta.",
    specialist: "chef que assina o menu há 8 anos",
    proof: "massa fresca feita no dia",
    outcome: "comer bem em casa",
    keywords: ["delivery", "menu", "reserva", "rodízio", "almoço"],
    ageMin: 22,
    ageMax: 55,
  },
  advocacia: {
    pain: "processo que arrasta sem resposta",
    painDetail: "Você liga, ninguém retorna, e o prazo passa",
    objection: "Quanto custa a consulta?",
    answer: "A primeira análise é gratuita e você recebe o parecer por escrito, sem compromisso.",
    specialist: "advogado com 14 anos de causa trabalhista",
    proof: "acompanhamento com atualização por WhatsApp",
    outcome: "saber exatamente onde está seu processo",
    keywords: ["direito", "processo", "consulta", "parecer", "prazo"],
    ageMin: 28,
    ageMax: 60,
  },
  contabilidade: {
    pain: "trocar de contador todo ano",
    painDetail: "Você nunca sabe quanto vai pagar de imposto até o boleto chegar",
    objection: "Vocês atendem MEI?",
    answer: "Atendemos MEI, Simples e Lucro Presumido, com plano por faixa de faturamento.",
    specialist: "contador com 600 empresas na carteira",
    proof: "fechamento mensal com relatório em linguagem simples",
    outcome: "parar de pagar imposto a mais",
    keywords: ["imposto", "MEI", "Simples Nacional", "folha", "fechamento"],
    ageMin: 26,
    ageMax: 58,
  },
  ecommerce: {
    pain: "comprar e se arrepender",
    painDetail: "O produto chega diferente da foto e a devolução é um parto",
    objection: "E se eu não gostar?",
    answer: "30 dias para devolver, etiqueta paga por nós, sem perguntas.",
    specialist: "quem testou 40 marcas antes de escolher essa",
    proof: "garantia estendida e nota fiscal",
    outcome: "receber o que viu na foto",
    keywords: ["frete grátis", "garantia", "estoque", "kit", "promoção"],
    ageMin: 24,
    ageMax: 50,
  },
  infoproduto: {
    pain: "assistir aula e não aplicar nada",
    painDetail: "Você junta curso, salva PDF e continua no mesmo lugar",
    objection: "Serve pra iniciante?",
    answer: "Sim: começa pelo módulo zero e a primeira campanha sai no dia 3.",
    specialist: "quem já geriu 40 milhões em anúncios",
    proof: "plano de ação semanal e grupo de implementação",
    outcome: "rodar a primeira campanha em 7 dias",
    keywords: ["curso", "campanha", "tráfego", "aula", "mentoria"],
    ageMin: 22,
    ageMax: 45,
  },
};

const BRANDS: Brand[] = [
  { name: "Atacado Bella Moda", domain: "atacadobellamoda.com.br", vertical: "moda-atacado", product: "coleção verão em atacado", benefit: "12 peças por R$ 349 e grade fechada", price: 349, tech: ["Shopify", "Klaviyo", "Meta Pixel"], verified: true, heat: 0.95, city: "Goiânia", gender: "female", affiliate: { network: "Hotmart", id: "OF-88213" }, lpTitle: "Atacado Bella Moda — coleção verão 2027" },
  { name: "Confecção Vila Rica", domain: "confeccaovilarica.com.br", vertical: "moda-atacado", product: "kit revenda de inverno", benefit: "peças com giro comprovado em 30 dias", price: 590, tech: ["Nuvemshop", "Google Analytics", "RD Station"], verified: true, heat: 0.62, city: "Americana", gender: "female", lpTitle: "Kit revenda Vila Rica" },
  { name: "Use Bella Varejo", domain: "usebella.com.br", vertical: "moda-varejo", product: "vestido midi alfaiataria", benefit: "do P ao GG, sem transparência", price: 189, tech: ["Shopify", "Tray", "Meta Pixel"], verified: false, heat: 0.78, city: "São Paulo", gender: "female", affiliate: { network: "Monetizze", id: "OF-44190" }, lpTitle: "Vestido midi — Use Bella" },
  { name: "Boutique Cíntia Reis", domain: "cintiareis.com.br", vertical: "moda-varejo", product: "look completo de festa", benefit: "3 peças que já saem combinando", price: 420, tech: ["WooCommerce", "WordPress", "Mailchimp"], verified: false, heat: 0.44, city: "Curitiba", gender: "female", lpTitle: "Looks de festa — Cíntia Reis" },
  { name: "Studio Aurora Estética", domain: "studioaurora.com.br", vertical: "estetica", product: "protocolo de clareamento facial", benefit: "avaliação com foto antes e depois", price: 1490, tech: ["WordPress", "Elementor", "Meta Pixel"], verified: true, heat: 0.86, city: "Belo Horizonte", gender: "female", lpTitle: "Clareamento facial — Studio Aurora" },
  { name: "Clínica Lumière", domain: "clinicalumiere.com.br", vertical: "estetica", product: "harmonização facial", benefit: "planejamento com 2 profissionais", price: 2400, tech: ["Wix", "Google Tag Manager", "Hotjar"], verified: true, heat: 0.55, city: "Recife", gender: "female", lpTitle: "Harmonização facial — Lumière" },
  { name: "Odonto Sorriso Prime", domain: "sorrisoprime.com.br", vertical: "odontologia", product: "implante com carga imediata", benefit: "tomografia e planejamento digital inclusos", price: 3200, tech: ["WordPress", "RD Station", "Meta Pixel"], verified: true, heat: 0.9, city: "São Paulo", gender: "all", lpTitle: "Implante dentário — Sorriso Prime" },
  { name: "Instituto Dental Vita", domain: "dentalvita.com.br", vertical: "odontologia", product: "clareamento a laser", benefit: "3 tons em sessão única", price: 890, tech: ["Wix", "Google Ads", "WhatsApp Business"], verified: false, heat: 0.5, city: "Campinas", gender: "female", lpTitle: "Clareamento a laser — Dental Vita" },
  { name: "Imóveis Horizonte", domain: "imoveishorizonte.com.br", vertical: "imobiliaria", product: "apartamento 2 quartos com varanda", benefit: "entrada a partir de R$ 18 mil", price: 389000, tech: ["WordPress", "Zap Imóveis", "Meta Pixel"], verified: true, heat: 0.72, city: "Campinas", gender: "all", lpTitle: "Apartamento com varanda — Horizonte" },
  { name: "Construtora Bela Vista", domain: "belavistaempreendimentos.com.br", vertical: "imobiliaria", product: "casa em condomínio fechado", benefit: "obra com entrega em 18 meses", price: 640000, tech: ["Next.js", "Google Tag Manager", "RD Station"], verified: true, heat: 0.48, city: "Goiânia", gender: "all", lpTitle: "Casa em condomínio — Bela Vista" },
  { name: "AutoCenter Prime Veículos", domain: "primeveiculos.com.br", vertical: "automoveis", product: "SUV seminovo 2023", benefit: "laudo cautelar e garantia de 12 meses", price: 129900, tech: ["WordPress", "Meta Pixel", "Google Analytics"], verified: true, heat: 0.83, city: "São Paulo", gender: "male", affiliate: { network: "Braip", id: "OF-77201" }, lpTitle: "SUV seminovo — Prime Veículos" },
  { name: "Garage Motors", domain: "garagemotors.com.br", vertical: "automoveis", product: "hatch automático até R$ 59 mil", benefit: "aprovação de crédito em 24h", price: 59000, tech: ["Wix", "Google Ads", "WhatsApp Business"], verified: false, heat: 0.4, city: "Porto Alegre", gender: "male", lpTitle: "Hatch automático — Garage Motors" },
  { name: "Trattoria Nonna", domain: "trattorianonna.com.br", vertical: "restaurante", product: "rodízio de massa artesanal", benefit: "massa fresca feita no dia", price: 89, tech: ["WordPress", "iFood", "Google Analytics"], verified: false, heat: 0.66, city: "São Paulo", gender: "all", lpTitle: "Rodízio de massa — Trattoria Nonna" },
  { name: "Sushi Kaito", domain: "sushikaito.com.br", vertical: "restaurante", product: "combinado para 2", benefit: "entrega em 32 minutos", price: 149, tech: ["Nuvemshop", "iFood", "Meta Pixel"], verified: true, heat: 0.58, city: "Curitiba", gender: "all", lpTitle: "Combinado para 2 — Sushi Kaito" },
  { name: "Almeida & Prado Advogados", domain: "almeidaprado.adv.br", vertical: "advocacia", product: "análise de rescisão trabalhista", benefit: "parecer por escrito em 48h", price: 0, tech: ["WordPress", "RD Station", "Google Tag Manager"], verified: true, heat: 0.52, city: "São Paulo", gender: "all", lpTitle: "Rescisão trabalhista — Almeida & Prado" },
  { name: "Contábil Nexo", domain: "contabilnexo.com.br", vertical: "contabilidade", product: "abertura de empresa sem custo", benefit: "fechamento mensal com relatório simples", price: 249, tech: ["Next.js", "RD Station", "Google Analytics"], verified: false, heat: 0.46, city: "Belo Horizonte", gender: "all", lpTitle: "Abertura de empresa — Contábil Nexo" },
  { name: "Lumina Skincare", domain: "luminaskin.com.br", vertical: "ecommerce", product: "kit vitamina C + ácido hialurônico", benefit: "30 dias de garantia, etiqueta paga", price: 219, tech: ["Shopify", "Klaviyo", "Meta Pixel"], verified: true, heat: 0.88, city: "São Paulo", gender: "female", affiliate: { network: "Hotmart", id: "OF-10932" }, lpTitle: "Kit vitamina C — Lumina" },
  { name: "NutriVita Suplementos", domain: "nutriviita.com.br", vertical: "ecommerce", product: "whey concentrado 900g", benefit: "laudo de pureza em cada lote", price: 159, tech: ["Nuvemshop", "Google Shopping", "Meta Pixel"], verified: false, heat: 0.64, city: "Campinas", gender: "male", affiliate: { network: "Monetizze", id: "OF-33218" }, lpTitle: "Whey concentrado — NutriVita" },
  { name: "Colchões Sono Leve", domain: "somoleve.com.br", vertical: "ecommerce", product: "colchão queen molas ensacadas", benefit: "120 noites de teste em casa", price: 1490, tech: ["VTEX", "Google Analytics", "Meta Pixel"], verified: true, heat: 0.7, city: "São Paulo", gender: "all", lpTitle: "Colchão queen — Sono Leve" },
  { name: "Óculos Visão Clara", domain: "visaoclara.com.br", vertical: "ecommerce", product: "óculos de sol polarizado", benefit: "lente com proteção UV400", price: 179, tech: ["Shopify", "Tiktok Pixel", "Klaviyo"], verified: false, heat: 0.61, city: "Recife", gender: "all", affiliate: { network: "Braip", id: "OF-58442" }, lpTitle: "Óculos polarizado — Visão Clara" },
  { name: "Fone SoundCore Brasil", domain: "soundcorebrasil.com.br", vertical: "ecommerce", product: "fone bluetooth com cancelamento", benefit: "40h de bateria e 2 anos de garantia", price: 429, tech: ["VTEX", "Google Shopping", "Meta Pixel"], verified: true, heat: 0.76, city: "São Paulo", gender: "all", lpTitle: "Fone com cancelamento — SoundCore" },
  { name: "Semijoias Aurora", domain: "semijoiasaurora.com.br", vertical: "ecommerce", product: "kit 5 semijoias banhadas", benefit: "banho de 5 micras, não escurece", price: 139, tech: ["Nuvemshop", "Meta Pixel", "Mailchimp"], verified: false, heat: 0.69, city: "Goiânia", gender: "female", affiliate: { network: "Ticto", id: "OF-90112" }, lpTitle: "Kit semijoias — Aurora" },
  { name: "Móveis Casa Nova", domain: "casanova.com.br", vertical: "ecommerce", product: "sofá retrátil 3 lugares", benefit: "entrega e montagem no mesmo dia", price: 2290, tech: ["VTEX", "Google Analytics", "Meta Pixel"], verified: true, heat: 0.43, city: "Curitiba", gender: "all", lpTitle: "Sofá retrátil — Casa Nova" },
  { name: "Perfume Essence", domain: "essenceparfums.com.br", vertical: "ecommerce", product: "perfume importado 100ml", benefit: "fixação de 12 horas", price: 259, tech: ["Shopify", "Tiktok Pixel", "Klaviyo"], verified: false, heat: 0.57, city: "São Paulo", gender: "female", affiliate: { network: "Hotmart", id: "OF-66123" }, lpTitle: "Perfume importado — Essence" },
  { name: "Café do Cerrado", domain: "cafedocerrado.com.br", vertical: "ecommerce", product: "assinatura de café especial", benefit: "torra na semana do envio", price: 79, tech: ["Shopify", "Klaviyo", "Google Analytics"], verified: true, heat: 0.38, city: "Patrocínio", gender: "all", lpTitle: "Assinatura de café — Cerrado" },
  { name: "Pet Amigo", domain: "petamigo.com.br", vertical: "ecommerce", product: "plano de saúde pet", benefit: "consultas e vacinas sem coparticipação", price: 89, tech: ["WordPress", "RD Station", "Meta Pixel"], verified: false, heat: 0.51, city: "Belo Horizonte", gender: "all", lpTitle: "Plano de saúde pet — Pet Amigo" },
  { name: "Academia Corpo Ativo", domain: "corpoativo.com.br", vertical: "estetica", product: "12 semanas de treino acompanhado", benefit: "avaliação física e plano individual", price: 399, tech: ["Wix", "Google Ads", "WhatsApp Business"], verified: false, heat: 0.47, city: "Porto Alegre", gender: "all", lpTitle: "Treino acompanhado — Corpo Ativo" },
  { name: "Curso Tráfego de Elite", domain: "trafegodeelite.com.br", vertical: "infoproduto", product: "mentoria de tráfego pago", benefit: "plano de ação semanal e grupo de implementação", price: 1997, tech: ["Hotmart", "VTurb", "Meta Pixel"], verified: false, heat: 0.92, city: "São Paulo", gender: "male", affiliate: { network: "Hotmart", id: "OF-20881" }, lpTitle: "Mentoria de tráfego — Elite" },
  { name: "Método Escala 10x", domain: "escala10x.com.br", vertical: "infoproduto", product: "curso de gestão de tráfego", benefit: "primeira campanha no dia 3", price: 497, tech: ["Kiwify", "VTurb", "Meta Pixel"], verified: false, heat: 0.73, city: "Recife", gender: "male", affiliate: { network: "Kiwify", id: "OF-44720" }, lpTitle: "Curso de gestão de tráfego — Escala 10x" },
  { name: "Viagens Sol & Mar", domain: "solimarturismo.com.br", vertical: "ecommerce", product: "pacote 7 noites em Porto de Galinhas", benefit: "aéreo, hotel e transfer inclusos", price: 3490, tech: ["WordPress", "Google Analytics", "Meta Pixel"], verified: true, heat: 0.59, city: "Recife", gender: "all", lpTitle: "Pacote Porto de Galinhas — Sol & Mar" },
];

const TESTIMONIALS = [
  "Fechei na primeira conversa, chegou antes do prazo e veio exatamente como na foto.",
  "Já era cliente de outra loja e voltei. O atendimento no WhatsApp resolve em minutos.",
  "Comprei desconfiada e virou minha compra recorrente. O pós-venda é o diferencial.",
  "O que mais me pegou foi a transparência no preço. Sem taxa escondida no checkout.",
  "Testei por 30 dias e o resultado apareceu na segunda semana.",
  "Pedi na sexta, chegou no sábado de manhã. Não tem como reclamar.",
  "O time respondeu todas as dúvidas antes de eu pagar. Isso mudou minha decisão.",
  "Cancelei outro serviço e fiquei só com esse. Vale cada real.",
];

const COMMENT_AUTHORS = ["Marcela R.", "Tiago F.", "Juliana P.", "Rodrigo M.", "Camila S.", "Anderson L.", "Patrícia N.", "Vitor H.", "Bruna C.", "Leandro A."];

const COMMENT_POOL: Record<string, string[]> = {
  default: [
    "Quanto fica pra mandar pra Salvador?",
    "Tem esse modelo em outra cor?",
    "Já comprei e recomendo, chegou rápido.",
    "Vocês parcelam em quantas vezes?",
    "Preço à vista tem desconto?",
    "Manda o link do catálogo completo por favor",
    "Atende no sábado?",
    "Esse valor é por peça ou pelo kit?",
  ],
  "moda-atacado": [
    "Qual o valor mínimo pra primeira compra?",
    "A grade vem fechada ou posso escolher tamanho?",
    "Faz envio pra todo o Brasil?",
    "Quantas peças vêm nesse kit?",
  ],
  estetica: [
    "Quantas sessões precisa pra ver resultado?",
    "Dói? Tenho medo de agulha",
    "Tem avaliação gratuita?",
    "Atende com convênio?",
  ],
  odontologia: [
    "Quanto tempo dura o implante?",
    "Faz parcelamento no cartão?",
    "Atende à noite?",
    "A avaliação é gratuita?",
  ],
  automoveis: [
    "Aceita meu carro na troca?",
    "Qual o valor da parcela?",
    "Tem histórico de sinistro?",
    "Faz test drive no fim de semana?",
  ],
  infoproduto: [
    "Serve pra quem nunca rodou anúncio?",
    "Tem garantia?",
    "Por quanto tempo tenho acesso?",
    "Emite nota fiscal?",
  ],
};

const AFFILIATE_NETWORKS = ["Hotmart", "Monetizze", "Braip", "Ticto", "Kiwify", "Amazon Associados"];

const CTA_BY_VERTICAL: Record<string, string[]> = {
  default: ["Comprar agora", "Saiba mais", "Enviar mensagem", "Cadastre-se"],
  imobiliaria: ["Saiba mais", "Enviar mensagem", "Ligar agora"],
  automoveis: ["Saiba mais", "Enviar mensagem", "Ligar agora"],
  restaurante: ["Pedir agora", "Reservar", "Enviar mensagem"],
  advocacia: ["Saiba mais", "Enviar mensagem", "Fale conosco"],
  contabilidade: ["Saiba mais", "Cadastre-se", "Fale conosco"],
  estetica: ["Agendar", "Enviar mensagem", "Saiba mais"],
  odontologia: ["Agendar", "Enviar mensagem", "Saiba mais"],
  infoproduto: ["Saiba mais", "Cadastre-se", "Baixar"],
};

function rng(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function pick<T>(random: () => number, list: T[]): T {
  return list[Math.floor(random() * list.length)];
}

function money(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

function stamp(daysAgo: number, hour = 10): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, (daysAgo * 17) % 60, 0, 0);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

type AngleResult = { headline: string; body: string; description: string; cta: string; media: string };

function buildAngle(
  angle: number,
  brand: Brand,
  meta: VerticalMeta,
  random: () => number,
): AngleResult {
  const ctas = CTA_BY_VERTICAL[brand.vertical] ?? CTA_BY_VERTICAL.default;
  const cta = pick(random, ctas);
  const media = pick(random, ["image", "image", "video", "carousel", "link"]);
  const proofNumber = 1200 + Math.floor(random() * 98000);
  const discount = 10 + Math.floor(random() * 35);
  const slots = 6 + Math.floor(random() * 14);
  const left = 2 + Math.floor(random() * 4);
  const testimonial = pick(random, TESTIMONIALS);
  const price = brand.price > 0 ? money(brand.price) : "consulta gratuita";

  switch (angle) {
    case 0:
      return {
        headline: `${brand.product} com ${discount}% OFF nesta semana`,
        body: `${brand.name} abriu ${brand.product} por ${price} — ${brand.benefit}.\n\n${meta.keywords[0]} com ${meta.proof} e envio para todo o Brasil.`,
        description: `${brand.benefit}. ${brand.city} e região.`,
        cta,
        media,
      };
    case 1:
      return {
        headline: `Mais de ${proofNumber.toLocaleString("pt-BR")} pessoas já passaram pela ${brand.name}`,
        body: `"${testimonial}"\n\n${brand.benefit}. Se quiser ver de perto, chama no WhatsApp que a gente manda foto e vídeo real.`,
        description: `Avaliações reais de clientes de ${brand.city}.`,
        cta,
        media,
      };
    case 2:
      return {
        headline: `Se ${meta.pain} está te travando, leia isso`,
        body: `${meta.painDetail}. Foi por isso que a ${brand.name} montou ${brand.product}: ${brand.benefit}.\n\nSem letra miúda — você vê o valor final antes de fechar.`,
        description: "A solução que resolve o problema na origem.",
        cta,
        media,
      };
    case 3:
      return {
        headline: `Últimas ${left} vagas de ${brand.product} em ${brand.city}`,
        body: `Abrimos ${slots} horários para esta semana e ${left} continuam livres.\n\n${brand.benefit}. Responder aqui garante a prioridade no atendimento.`,
        description: `Agenda de ${brand.city} — vagas limitadas.`,
        cta,
        media,
      };
    case 4:
      return {
        headline: `${meta.specialist} explica o que ninguém fala sobre ${brand.product}`,
        body: `"O erro não é o preço, é escolher sem avaliar."\n\nNa ${brand.name}, ${brand.benefit}, com acompanhamento de quem faz isso todos os dias em ${brand.city}.`,
        description: "Análise técnica, sem promessa mágica.",
        cta,
        media,
      };
    case 5:
      return {
        headline: `Por dentro da ${brand.name}: como ${brand.product} é feito`,
        body: `Bastidores desta semana: ${brand.benefit}. Nada de estoque de terceiro ou foto de banco de imagens.\n\nQuer ver o processo completo? Chama aqui.`,
        description: "Bastidores reais, sem edição.",
        cta,
        media,
      };
    case 6:
      return {
        headline: `"${meta.objection}" — a resposta direta`,
        body: `${meta.answer}\n\nÉ por isso que ${brand.benefit}. A ${brand.name} atende ${brand.city} e região.`,
        description: "Tire a dúvida antes de decidir.",
        cta,
        media,
      };
    default:
      return {
        headline: `Se não ${meta.outcome}, você não paga`,
        body: `${brand.name}: ${brand.benefit}.\n\nGarantia de verdade, por escrito, sem precisar brigar no atendimento. ${brand.city}, ${meta.keywords[1] ?? "atendimento"} com hora marcada.`,
        description: "Garantia registrada em contrato.",
        cta,
        media,
      };
  }
}

function reactionSet(likes: number, random: () => number) {
  const like = Math.round(likes * (0.78 + random() * 0.1));
  const love = Math.round(likes * (0.06 + random() * 0.08));
  const haha = Math.round(likes * (0.015 + random() * 0.03));
  const wow = Math.round(likes * (0.01 + random() * 0.025));
  const sad = Math.round(likes * random() * 0.02);
  const angry = Math.round(likes * random() * 0.015);
  return { like, love, haha, wow, sad, angry };
}

export function seedRadar(db: DatabaseSync) {
  const random = rng(20261102);

  const insert = db.prepare(`
    INSERT INTO radar_ads (
      external_id, source, advertiser, advertiser_id, page_verified, network, start_date, stop_date,
      first_seen, last_seen, active, country, language, gender, age_min, age_max, media_type, cta,
      headline, body, description, landing_url, landing_domain, landing_title, redirect_chain, tech_stack,
      offer_id, affiliate_network, likes, comments, shares, reactions, likes_series, best_comments,
      fingerprint, winning_score, momentum, variant_count, copy_count, snapshot_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 0, NULL, ?)
  `);

  type Draft = {
    id: number;
    external_id: string;
    advertiser: string;
    vertical: string;
    fingerprint: string;
    likes: number;
    days: number;
    momentum: number;
    active: number;
    start_date: string;
    stop_date: string | null;
    last_seen: string;
    headline: string | null;
    body: string;
    landing_domain: string | null;
    landing_title: string | null;
    tech_stack: string | null;
    cta: string | null;
    comments: number;
    shares: number;
  };

  const drafts: Draft[] = [];
  let sequence = 1;

  const insertDraft = (params: {
    brand: Brand;
    meta: VerticalMeta;
    angle: number;
    startDaysAgo: number;
    runDays: number;
    active: boolean;
    heat: number;
    bodyOverride?: string;
    headlineOverride?: string;
  }) => {
    const { brand, meta, angle, startDaysAgo, runDays, active } = params;
    const copy = buildAngle(angle, brand, meta, random);
    const headline = params.headlineOverride ?? copy.headline;
    const body = params.bodyOverride ?? copy.body;

    const country = random() < 0.88 ? "BR" : random() < 0.5 ? "PT" : pick(random, ["US", "MX", "AR"]);
    const language = country === "BR" || country === "PT" ? "pt" : country === "MX" || country === "AR" ? "es" : "en";
    const network = pick(random, brand.vertical === "infoproduto" ? ["facebook", "instagram"] : ["facebook", "facebook", "instagram", "instagram"]);

    const parsedStart = new Date(`${dateOnly(startDaysAgo)}T00:00:00Z`);
    const parsedStop = active ? null : new Date(parsedStart.getTime() + runDays * 86_400_000);
    const stopDate = parsedStop ? parsedStop.toISOString().slice(0, 10) : null;
    const lastSeen = active ? stamp(Math.floor(random() * 2), 6 + Math.floor(random() * 14)) : stamp(Math.max(0, startDaysAgo - runDays), 9);

    const shape = pick(random, ["steady", "spike", "late", "steady", "flat"] as const);
    const base = Math.pow(random(), 2.3) * 78000 * params.heat + 25;
    const likes = random() < 0.05 ? Math.round(base * 6) : Math.round(base);
    const comments = Math.round(likes * (0.03 + random() * 0.07));
    const shares = Math.round(likes * (0.012 + random() * 0.05));
    const series = buildSeries(likes, runDays, shape);
    const momentum = momentumOf(series, runDays, likes);

    const commentPool = COMMENT_POOL[brand.vertical] ?? COMMENT_POOL.default;
    const bestComments = Array.from({ length: 2 + Math.floor(random() * 2) }, () => ({
      author: pick(random, COMMENT_AUTHORS),
      text: pick(random, commentPool),
      likes: Math.round(likes * (0.002 + random() * 0.01)),
    }));

    const path = pick(random, ["", "/lp", "/produto", "/oferta", "/colecao"]);
    const finalUrl = `https://${brand.domain}${path || "/"}`;
    const redirect = random() < 0.24 ? JSON.stringify([`https://go.${brand.domain}/c/${Math.floor(random() * 900000) + 100000}`, finalUrl]) : null;
    const offer = brand.affiliate;
    const fp = fingerprintOf(headline, body);

    const result = insert.run(
      `sbx_${sequence}`,
      "sandbox",
      brand.name,
      `page_${1000 + (sequence % 900)}`,
      brand.verified ? 1 : 0,
      network,
      dateOnly(startDaysAgo),
      stopDate,
      stamp(startDaysAgo, 8),
      lastSeen,
      active ? 1 : 0,
      country,
      language,
      brand.gender,
      meta.ageMin,
      meta.ageMax,
      copy.media,
      copy.cta,
      headline,
      body,
      copy.description,
      finalUrl,
      brand.domain,
      brand.lpTitle,
      redirect,
      brand.tech.join(","),
      offer?.id ?? null,
      offer?.network ?? (random() < 0.15 ? pick(random, AFFILIATE_NETWORKS) : null),
      likes,
      comments,
      shares,
      JSON.stringify(reactionSet(likes, random)),
      JSON.stringify(series),
      JSON.stringify(bestComments),
      fp,
      stamp(startDaysAgo + (active ? 0 : runDays), 9),
    );

    const id = Number(result.lastInsertRowid);
    sequence++;
    drafts.push({
      id,
      external_id: `sbx_${id}`,
      advertiser: brand.name,
      vertical: brand.vertical,
      fingerprint: fp,
      likes,
      days: runDays,
      momentum,
      active: active ? 1 : 0,
      start_date: dateOnly(startDaysAgo),
      stop_date: stopDate,
      last_seen: lastSeen,
      headline,
      body,
      landing_domain: brand.domain,
      landing_title: brand.lpTitle,
      tech_stack: brand.tech.join(","),
      cta: copy.cta,
      comments,
      shares,
    });
  };

  // 1) base por marca
  for (const brand of BRANDS) {
    const meta = VERTICAL_META[brand.vertical];
    const howMany = 5 + Math.floor(random() * 3);
    for (let i = 0; i < howMany; i++) {
      const startDaysAgo = 2 + Math.floor(random() * 400);
      const wanted = 4 + Math.floor(random() * Math.min(240, startDaysAgo));
      const runDays = Math.min(startDaysAgo, wanted);
      const active = runDays >= startDaysAgo - 2;
      insertDraft({
        brand,
        meta,
        angle: i % 8,
        startDaysAgo,
        runDays: Math.max(2, runDays),
        active,
        heat: brand.heat * (0.6 + random() * 0.8),
      });
    }
  }

  // 2) clones: concorrentes rodando o criativo de um vencedor
  const cloneable = drafts.filter((draft) => draft.likes > 12000).slice(0, 26);
  for (const source of cloneable) {
    const siblings = BRANDS.filter((brand) => brand.vertical === source.vertical && brand.name !== source.advertiser);
    if (siblings.length === 0) continue;
    const clones = 1 + Math.floor(random() * 3);
    for (let c = 0; c < clones; c++) {
      const copycat = pick(random, siblings);
      const startDaysAgo = 3 + Math.floor(random() * 40);
      insertDraft({
        brand: copycat,
        meta: VERTICAL_META[copycat.vertical],
        angle: 0,
        startDaysAgo,
        runDays: Math.max(2, startDaysAgo - Math.floor(random() * 3)),
        active: random() < 0.7,
        heat: copycat.heat * 0.5,
        bodyOverride: source.body,
        headlineOverride: source.headline ?? undefined,
      });
    }
  }

  // 3) passada final: agrupamento por criativo + Winning Score
  const groups = new Map<string, Draft[]>();
  for (const draft of drafts) {
    const list = groups.get(draft.fingerprint) ?? [];
    list.push(draft);
    groups.set(draft.fingerprint, list);
  }

  const updateScore = db.prepare("UPDATE radar_ads SET winning_score = ?, momentum = ?, variant_count = ?, copy_count = ? WHERE id = ?");
  for (const draft of drafts) {
    const group = groups.get(draft.fingerprint) ?? [draft];
    const variants = group.length;
    const copies = new Set(group.map((item) => item.advertiser)).size - 1;
    const { score } = winningScore({
      days: draft.days,
      likes: draft.likes,
      comments: draft.comments,
      shares: draft.shares,
      momentum: draft.momentum,
      variants,
      copies,
      hasLanding: Boolean(draft.landing_domain),
      hasTitle: Boolean(draft.landing_title),
      hasTech: Boolean(draft.tech_stack),
      hasCta: Boolean(draft.cta),
      active: draft.active === 1,
    });
    updateScore.run(score, Number(draft.momentum.toFixed(2)), variants, copies, draft.id);
  }

  // 4) índice de busca
  const index = db.prepare("INSERT INTO radar_ads_fts (rowid, body, headline, landing_title, advertiser, comments) VALUES (?, ?, ?, ?, ?, ?)");
  for (const draft of drafts) {
    const comments = db.prepare("SELECT best_comments FROM radar_ads WHERE id = ?").get(draft.id) as { best_comments: string };
    const text = (JSON.parse(comments.best_comments) as { text: string }[]).map((item) => item.text).join(" ");
    index.run(draft.id, draft.body, draft.headline ?? "", draft.landing_title ?? "", draft.advertiser, text);
  }

  // 5) marcas monitoradas
  const brandInsert = db.prepare("INSERT OR IGNORE INTO radar_brands (name, domain, note, created_at) VALUES (?, ?, ?, ?)");
  const watched = [
    { name: "Atacado Bella Moda", domain: "atacadobellamoda.com.br", note: "Referência em atacado feminino. Copiar o gancho de preço." },
    { name: "Lumina Skincare", domain: "luminaskin.com.br", note: "Escala agressiva em vídeo UGC. Monitorar novos criativos." },
    { name: "Odonto Sorriso Prime", domain: "sorrisoprime.com.br", note: "Melhor prova social do nicho odontológico." },
    { name: "Curso Tráfego de Elite", domain: "trafegodeelite.com.br", note: "Concorrente direto no infoproduto." },
    { name: "Imóveis Horizonte", domain: "imoveishorizonte.com.br", note: "Testa oferta de entrada baixa. Ver o que converte." },
  ];
  for (const item of watched) brandInsert.run(item.name, item.domain, item.note, stamp(Math.floor(random() * 40), 11));

  // 6) coleções
  const collectionInsert = db.prepare("INSERT INTO radar_collections (name, color, created_at) VALUES (?, ?, ?)");
  const itemInsert = db.prepare("INSERT OR IGNORE INTO radar_collection_items (collection_id, ad_id, created_at) VALUES (?, ?, ?)");
  const boards = [
    { name: "Ganchos de atacado", color: "#a3f04b", size: 6 },
    { name: "Vídeos UGC que escalaram", color: "#9a86ff", size: 5 },
    { name: "Ofertas de entrada baixa", color: "#4fd1c5", size: 4 },
  ];
  const sorted = [...drafts].sort((a, b) => b.likes - a.likes);
  boards.forEach((board, boardIndex) => {
    const result = collectionInsert.run(board.name, board.color, stamp(20 - boardIndex * 4, 15));
    const collectionId = Number(result.lastInsertRowid);
    sorted.slice(boardIndex * 4, boardIndex * 4 + board.size).forEach((draft) => {
      itemInsert.run(collectionId, draft.id, stamp(10, 12));
    });
  });

  // 7) alertas
  const alertInsert = db.prepare("INSERT INTO radar_alerts (kind, ad_id, brand_id, detail, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?)");
  const newAds = [...drafts].filter((draft) => draft.active === 1).slice(0, 8);
  newAds.forEach((draft, index) => {
    const kind = index % 3 === 0 ? "new_ad" : index % 3 === 1 ? "clone" : "new_winner";
    const detail =
      kind === "new_ad"
        ? `${draft.advertiser} começou a rodar um anúncio novo em ${draft.vertical}.`
        : kind === "clone"
          ? `Criativo de ${draft.advertiser} está sendo copiado por concorrentes.`
          : `${draft.advertiser} entrou no radar de vencedores com score alto.`;
    alertInsert.run(kind, draft.id, null, detail, stamp(index, 8 + index), index > 3 ? stamp(index, 9) : null);
  });

  // 8) buscas salvas
  const savedInsert = db.prepare("INSERT INTO radar_saved (name, query, created_at) VALUES (?, ?, ?)");
  savedInsert.run("Atacado rodando há 60+ dias", "q=atacado&durMin=60&ordem=duracao", stamp(12, 10));
  savedInsert.run("Vídeo com aceleração", "midia=video&ordem=aceleracao&visto=7", stamp(8, 16));
  savedInsert.run("Clones de skincare", "q=vitamina+c&ordem=score", stamp(4, 11));

  // 9) histórico de sincronização
  const syncInsert = db.prepare(
    "INSERT INTO radar_syncs (source, status, fetched, inserted, updated, message, started_at, finished_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  syncInsert.run("sandbox", "ok", drafts.length, drafts.length, 0, "Carga inicial da base de demonstração", stamp(0, 6), stamp(0, 6), 480);
}
