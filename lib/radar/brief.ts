import { getAiConfig } from "@/lib/ai";
import { getVariants } from "./search";
import type { RadarAd } from "./types";
import { daysRunning, parseSeries } from "./score";

export type Brief = { text: string; simulated: boolean; model: string };

function localBrief(ad: RadarAd, variants: number): Brief {
  const days = daysRunning(ad);
  const series = parseSeries(ad.likes_series);
  const trend = series.length > 7 && series[series.length - 1] > series[series.length - 8] * 1.25 ? "subindo" : "estável";
  const comments = (() => {
    try {
      return (JSON.parse(ad.best_comments) as { text: string; likes: number }[]).slice(0, 3);
    } catch {
      return [];
    }
  })();

  const lines = [
    `# Briefing — ${ad.advertiser}`,
    "",
    `**Criativo em análise:** ${ad.headline ?? "(sem título)"} · ${days} dias no ar · score ${Math.round(ad.winning_score)}/100 · ${variants} variação(ões) detectada(s).`,
    "",
    "## 1. Ângulo que está funcionando",
    `O anúncio abre com "${(ad.headline ?? ad.body).split(/[.!?]/)[0].slice(0, 90)}" e sustenta a promessa em formato ${ad.media_type === "video" ? "de vídeo" : ad.media_type}. O gatilho é ${ad.cta?.toLowerCase().includes("comprar") ? "transacional direto" : "de consideração, levando ao WhatsApp"}. A tendência de engajamento está ${trend}.`,
    "",
    "## 2. Três ganchos para testar",
    `1. **Prova concreta:** abra com o resultado e o tempo ("${days} dias no ar, ${ad.landing_domain ?? "site próprio"} recebendo clique").`,
    `2. **Objeção na frente:** "Antes de perguntar o preço, olha isso" — antecipa a dúvida de ${ad.landing_domain ?? "compra"}.`,
    `3. **Custo de não agir:** mostre o que a pessoa perde adiando a decisão, sem inventar prazo.`,
    "",
    "## 3. Roteiro de 30 segundos",
    "- 0–3s: tela do produto com o preço/oferta legível. Sem logo de abertura.",
    "- 3–10s: problema na voz do cliente, não na do vendedor.",
    `- 10–22s: demonstração real — o que muda depois de "${ad.cta ?? "falar com a gente"}".`,
    "- 22–30s: CTA único e específico, com o mesmo texto do botão do anúncio.",
    "",
    "## 4. Público e entrega",
    `Rodar em ${ad.network === "instagram" ? "Instagram (feed e reels)" : "Facebook (feed e stories)"}, ${ad.country}, ${ad.age_min ?? 18}–${ad.age_max ?? 65} anos, gênero ${ad.gender === "all" || !ad.gender ? "todos" : ad.gender === "female" ? "feminino" : "masculino"}.`,
    "",
    "## 5. O que validar antes de escalar",
    "- Mesma oferta e mesmo preço do criativo original: se mudar, a comparação perde valor.",
    "- Página de destino precisa repetir o gancho do anúncio em até 3 segundos de leitura.",
    comments.length
      ? `- Comentários reais trazem as objeções: ${comments.map((item) => `"${item.text}"`).join(" · ")}`
      : "- Colete os comentários do anunciante original e transforme cada um em resposta pronta.",
    "",
    "_Briefing gerado localmente a partir dos dados do anúncio (modo simulação). Configure AI_API_KEY para a versão com modelo._",
  ];

  return { text: lines.join("\n"), simulated: true, model: "local" };
}

export async function createBrief(ad: RadarAd): Promise<Brief> {
  const variants = getVariants(ad).length;
  const config = getAiConfig();
  if (!config.configured || !config.key) return localBrief(ad, variants);

  const days = daysRunning(ad);
  const prompt = [
    `Anúncio de ${ad.advertiser} no ${ad.network}.`,
    `Título: ${ad.headline ?? "(sem título)"}`,
    `Texto: ${ad.body}`,
    `CTA: ${ad.cta ?? "—"} · formato: ${ad.media_type} · ${days} dias no ar · país ${ad.country} · público ${ad.age_min}-${ad.age_max} ${ad.gender}`,
    `Página: ${ad.landing_domain ?? "—"} (${ad.landing_title ?? "sem título"}) · stack: ${ad.tech_stack ?? "—"}`,
    `Score ${Math.round(ad.winning_score)}/100 · ${variants} variações do mesmo criativo.`,
    "",
    "Escreva um briefing em português do Brasil com: 1) por que este anúncio funciona (3 linhas, sem achismo), 2) três ganchos para testar, 3) roteiro de 30s em bullets com timestamps, 4) público sugerido, 5) o que validar antes de escalar. Seja específico, não invente números de resultado e não prometa ganho financeiro.",
  ].join("\n");

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.6,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "Você é estrategista de criativos publicitários. Escreve em português do Brasil, direto, sem jargão vazio. Nunca inventa dados de desempenho, nunca promete resultado garantido e nunca sugere segmentação por atributo protegido.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!response.ok || !text) {
      const fallback = localBrief(ad, variants);
      return { ...fallback, text: `${fallback.text}\n\n_Provedor de IA respondeu com erro: ${payload.error?.message ?? response.status}._` };
    }
    return { text, simulated: false, model: config.model };
  } catch (error) {
    const fallback = localBrief(ad, variants);
    return {
      ...fallback,
      text: `${fallback.text}\n\n_Falha ao chamar a IA: ${error instanceof Error ? error.message : "erro desconhecido"}._`,
    };
  }
}
