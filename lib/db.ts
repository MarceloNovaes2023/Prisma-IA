import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { VERTICALS, renderTemplate, scoreLead } from "./verticals";
import { normalizePhone } from "./whatsapp";

const globalForDb = globalThis as unknown as { __fluxoDb?: DatabaseSync };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  vertical TEXT NOT NULL,
  stage TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  value REAL NOT NULL DEFAULT 0,
  owner TEXT NOT NULL,
  city TEXT,
  answers TEXT NOT NULL DEFAULT '{}',
  ai_mode TEXT NOT NULL DEFAULT 'copilot',
  notes TEXT,
  opted_in INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_inbound_at TEXT,
  last_outbound_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  template_key TEXT,
  provider_id TEXT,
  author TEXT NOT NULL DEFAULT 'human',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  template TEXT NOT NULL,
  sent_at TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL,
  carrier TEXT,
  tracking TEXT,
  cashback REAL NOT NULL DEFAULT 0,
  cashback_status TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vertical TEXT,
  stage_filter TEXT,
  template TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  type TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  order_id INTEGER,
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  pix_code TEXT,
  checkout_url TEXT,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_code ON payments(code);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_leads_vertical ON leads(vertical);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_due ON followups(status, due_at);
`;

export const TICKET_NUM: Record<string, number> = {
  imobiliaria: 420000,
  "moda-atacado": 1850,
  "moda-varejo": 230,
  estetica: 1400,
  odontologia: 1900,
  automoveis: 68000,
  restaurante: 180,
  advocacia: 4200,
  contabilidade: 890,
};

const OWNERS = ["Ana Paula", "Rafael Lima", "Juliana Souza", "Marcos Vieira", "Camila Rocha", "Diego Martins"];
const CITIES = ["São Paulo", "Campinas", "Belo Horizonte", "Curitiba", "Goiânia", "Recife", "Porto Alegre"];
const NAMES = [
  "Bruna Almeida", "Carlos Eduardo Prado", "Daniela Nogueira", "Eduardo Salles", "Fernanda Batista",
  "Gabriel Monteiro", "Helena Castro", "Igor Ferraz", "Jéssica Amaral", "Kleber Duarte",
  "Larissa Pires", "Marcelo Tavares", "Natália Bittencourt", "Otávio Braga", "Patrícia Coelho",
  "Rafaela Antunes", "Sérgio Vasconcelos", "Tatiane Freitas", "Ubiratan Melo", "Vanessa Farias",
  "Wagner Destri", "Yasmin Ribeiro", "Zélia Barbosa", "André Lacerda", "Bianca Siqueira",
  "Caio Rezende", "Débora Paiva", "Emerson Queiroz", "Flávia Bastos", "Gustavo Andrade",
  "Isabela Fontes", "João Vitor Ramos", "Karina Lopes", "Leandro Muniz", "Michele Barreto",
  "Nelson Aguiar", "Olívia Sampaio", "Paulo Ricardo Neves", "Queila Santana", "Rodrigo Pinheiro",
  "Sabrina Coutinho", "Thiago Bandeira", "Ursula Camargo", "Vinícius Rangel", "Wanessa Leal",
  "Xênia Cardoso", "Yuri Salgado", "Zuleide Moraes", "Aline Bezerra", "Benedito Farias",
  "Cecília Valadares", "Diogo Brandão", "Elaine Menezes", "Fábio Cerqueira", "Giovana Peixoto",
  "Henrique Bastos", "Ingrid Tomaz", "Jonas Vidal", "Kelly Andrade", "Luiz Felipe Rosa",
  "Marina Quintela", "Nilton César", "Odete Lins", "Pedro Henrique Sá", "Renata Vasques",
  "Samuel Tavares", "Tereza Cristina", "Ubirajara Nunes", "Verônica Duarte", "Wellington Braga",
  "Yara Portela", "Adriano Sales", "Beatriz Gomide", "Cristiano Maia", "Dulce Helena",
];

const CLIENT_REPLIES = [
  "Oi, vi o anúncio. Ainda está disponível?",
  "Boa tarde! Quanto fica?",
  "Pode me mandar mais fotos?",
  "Consigo para essa semana?",
  "Vou falar com meu marido e te chamo",
  "Fechado, pode mandar o link de pagamento",
  "Achei um pouco caro, tem desconto?",
  "Tenho interesse sim, como faço?",
  "Qual o prazo de entrega?",
  "Me explica melhor como funciona",
  "Vocês atendem no sábado?",
  "Já comprei com outra pessoa, obrigada",
  "Pode ser parcelado?",
  "Manda o endereço que eu passo aí",
];

const CARRIERS = ["Correios SEDEX", "Jadlog", "Loggi", "Motoboy próprio", "Azul Cargo"];

function iso(daysAgo: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  // formato SQLite/UTC — permite comparar com datetime('now')
  return d.toISOString().slice(0, 19).replace("T", " ");
}

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

function seed(db: DatabaseSync) {
  const random = rng(20261029);
  const insertLead = db.prepare(`
    INSERT INTO leads (name, phone, email, vertical, stage, score, source, tags, value, owner, city, answers, notes, opted_in, created_at, last_inbound_at, last_outbound_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);
  const insertMessage = db.prepare(`
    INSERT INTO messages (lead_id, direction, body, status, template_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertFollowup = db.prepare(`
    INSERT INTO followups (lead_id, step, due_at, status, template, sent_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertOrder = db.prepare(`
    INSERT INTO orders (lead_id, code, description, total, status, carrier, tracking, cashback, cashback_status, created_at, delivered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO payments (code, lead_id, order_id, provider, method, amount, status, external_id, pix_code, checkout_url, description, created_at, paid_at)
    VALUES (?, ?, ?, 'sandbox', ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
  `);
  let paymentCursor = 0;
  const insertEvent = db.prepare(`
    INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, ?, ?, ?)
  `);

  let nameCursor = 0;
  let phoneCursor = 1000;

  for (const vertical of VERTICALS) {
    const perVertical = vertical.slug === "moda-atacado" ? 9 : 7;
    for (let i = 0; i < perVertical; i++) {
      const name = NAMES[nameCursor++ % NAMES.length];
      const phone = normalizePhone(`55119${(10000000 + phoneCursor++ * 1379).toString().slice(0, 8)}`);
      // ~22% da base em etapa terminal: parte ganha (receita real), parte perdida.
      const openPool = vertical.stages.filter((stage) => !stage.kind);
      const wonStages = vertical.stages.filter((stage) => stage.kind === "won");
      const lostStages = vertical.stages.filter((stage) => stage.kind === "lost");
      const roll = random();
      let stage = openPool[0];
      if (roll < 0.17 && wonStages.length > 0) {
        stage = wonStages[0];
      } else if (roll < 0.24 && lostStages.length > 0) {
        stage = lostStages[0];
      } else {
        const stageIndex = Math.min(
          openPool.length - 1,
          Math.floor(Math.pow(random(), 1.3) * openPool.length + random()),
        );
        stage = openPool[stageIndex];
      }
      const answers: Record<string, string> = {};
      for (const question of vertical.qualification) {
        const option = pick(random, question.options);
        answers[question.key] = option.label;
      }
      const score = scoreLead(vertical.slug, answers);
      const daysAgo = Math.floor(random() * 26) + 1;
      const source = pick(random, vertical.playbook.channels);
      const city = pick(random, CITIES);
      const owner = pick(random, OWNERS);
      const value = Math.round(TICKET_NUM[vertical.slug] * (0.75 + random() * 0.85));
      const tags = [stage.label, score >= 75 ? "prioridade" : "nutrição"].join(",");
      const aiMode = random() > 0.72 ? "auto" : random() > 0.35 ? "copilot" : "off";

      const createdAt = iso(daysAgo, 8 + Math.floor(random() * 9), Math.floor(random() * 59));

      const leadId = Number(
        insertLead.run(
          name,
          phone,
          `${name.split(" ")[0].toLowerCase()}@email.com`,
          vertical.slug,
          stage.key,
          score,
          source,
          tags,
          value,
          owner,
          city,
          JSON.stringify(answers),
          null,
          createdAt,
          null,
          null,
        ).lastInsertRowid,
      );

      db.prepare("UPDATE leads SET ai_mode = ? WHERE id = ?").run(aiMode, leadId);
      insertEvent.run(leadId, "lead.created", `Lead captado via ${source}`, createdAt);

      // conversa
      const messageCount = 2 + Math.floor(random() * 5);
      let lastInbound: string | null = null;
      let lastOutbound: string | null = null;
      for (let m = 0; m < messageCount; m++) {
        const isOutbound = m % 2 === 0;
        const step = vertical.cadence[Math.min(vertical.cadence.length - 1, Math.floor(m / 2))];
        const moment = iso(
          Math.max(0, daysAgo - Math.floor(m / 2)),
          8 + Math.floor(random() * 10),
          Math.floor(random() * 59),
        );
        if (isOutbound) {
          const body = renderTemplate(step.template, {
            primeiro_nome: name.split(" ")[0],
            nome: name,
            vendedor: owner.split(" ")[0],
            empresa: "PRISMA IA",
            bairro: "Vila Mariana",
            peca: "vestido midi",
            procedimento: vertical.qualification[0].options[0].label,
            veiculo: "Onix 2023",
          });
          insertMessage.run(leadId, "out", body, "delivered", step.label, moment);
          if (!lastOutbound || moment > lastOutbound) lastOutbound = moment;
        } else {
          const body = pick(random, CLIENT_REPLIES);
          insertMessage.run(leadId, "in", body, "received", null, moment);
          if (!lastInbound || moment > lastInbound) lastInbound = moment;
        }
      }
      db.prepare(
        "UPDATE leads SET last_inbound_at = ?, last_outbound_at = ? WHERE id = ?",
      ).run(lastInbound, lastOutbound, leadId);

      // follow-ups pendentes
      if (!stage.kind && random() > 0.35) {
        const stageIndex = Math.max(0, openPool.findIndex((item) => item.key === stage.key));
        const stepIndex = Math.min(vertical.cadence.length - 1, stageIndex + 1);
        const step = vertical.cadence[stepIndex];
        const dueOffset = Math.floor(random() * 5) - 2;
        insertFollowup.run(
          leadId,
          stepIndex,
          iso(Math.max(0, daysAgo - step.day) + dueOffset, 9, 30),
          "pending",
          renderTemplate(step.template, {
            primeiro_nome: name.split(" ")[0],
            nome: name,
            vendedor: owner.split(" ")[0],
            empresa: "PRISMA IA",
            bairro: "Vila Mariana",
            peca: "vestido midi",
            procedimento: vertical.qualification[0].options[0].label,
            veiculo: "Onix 2023",
          }),
          null,
        );
      }

      // pedidos / logística
      const hasOrder = ["moda-atacado", "moda-varejo", "automoveis", "restaurante", "estetica", "odontologia", "contabilidade"].includes(vertical.slug);
      if (hasOrder && (stage.kind === "won" ? random() > 0.08 : random() > 0.5)) {
        const status = stage.kind === "won" ? "entregue" : pick(random, ["producao", "enviado", "entregue"]);
        const total = Math.round(value * (0.8 + random() * 0.4));
        const rule = vertical.cashback;
        const cashback =
          rule.kind === "percent" ? Math.round((total * rule.value) / 100) : rule.kind === "fixed" ? rule.value : 0;
        const cashbackStatus =
          cashback === 0 ? "none" : status === "entregue" ? pick(random, ["credited", "redeemed"]) : "pending";
        const orderId = Number(
          insertOrder.run(
            leadId,
            `FL-${2400 + Math.floor(random() * 900)}`,
            `${vertical.short} · ${vertical.qualification[0].options[0].label}`,
            total,
            status,
            status === "producao" ? null : pick(random, CARRIERS),
            status === "producao" ? null : `${pick(random, ["BR", "JL", "LG"])}${Math.floor(random() * 900000000 + 100000000)}BR`,
            cashback,
            cashbackStatus,
            iso(daysAgo, 10),
            status === "entregue" ? iso(Math.max(0, daysAgo - 2), 16) : null,
          ).lastInsertRowid,
        );

        // metade dos pedidos nasce com cobrança paga, metade aguardando PIX
        const pendingPayment = status === "producao" && random() > 0.45;
        if (pendingPayment) {
          db.prepare("UPDATE orders SET status = 'aguardando' WHERE id = ?").run(orderId);
        }
        const paymentCode = `PAY-${(9100 + paymentCursor++).toString()}`;
        insertPayment.run(
          paymentCode,
          leadId,
          orderId,
          pick(random, ["pix", "pix", "card"]),
          total,
          pendingPayment ? "pending" : "paid",
          `/pagar/${paymentCode}`,
          `Pedido ${vertical.short}`,
          iso(daysAgo, 10),
          pendingPayment ? null : iso(Math.max(0, daysAgo - 1), 14),
        );
      }
    }
  }

  db.prepare(
    "INSERT INTO broadcasts (name, vertical, stage_filter, template, total, sent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "Reativação · coleção primavera",
    "moda-atacado",
    "catalogo",
    "Oi {primeiro_nome}! Chegou a coleção nova com as peças que mais giram. Quer receber o catálogo atualizado?",
    68,
    61,
    "concluido",
    iso(6, 14),
  );
  db.prepare(
    "INSERT INTO broadcasts (name, vertical, stage_filter, template, total, sent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "Agenda aberta · avaliação gratuita",
    "estetica",
    "qualificado",
    "Oi {primeiro_nome}! Abri 6 horários de avaliação gratuita essa semana. Quer que eu reserve um pra você?",
    24,
    24,
    "concluido",
    iso(3, 9),
  );

  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("workspace", "PRISMA IA · Operação comercial");
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("whatsapp_mode", "sandbox");
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb(): DatabaseSync {
  if (globalForDb.__fluxoDb) return globalForDb.__fluxoDb;

  const file = process.env.FLUXO_DB ?? path.join(process.cwd(), "data", "fluxo.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  // várias instâncias escrevem no mesmo arquivo: espera a trava do SQLite em vez de falhar na hora
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);

  // migrações incrementais para bancos criados antes de IA e pagamentos
  ensureColumn(db, "messages", "author", "TEXT NOT NULL DEFAULT 'human'");
  ensureColumn(db, "leads", "ai_mode", "TEXT NOT NULL DEFAULT 'copilot'");

  // telefone sempre em dígitos (E.164 sem +), igual ao que a Cloud API entrega
  db.exec(
    "UPDATE leads SET phone = replace(replace(replace(phone,'+',''),' ',''),'-','') WHERE phone LIKE '+%' OR phone LIKE '% %' OR phone LIKE '%-%'",
  );

  const count = db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number };
  if (count.n === 0) seed(db);

  globalForDb.__fluxoDb = db;
  return db;
}
